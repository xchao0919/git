/**
 * 文本章节解析工具（移植自 text_tool.py）
 *
 * 把纯文本按章节规则切分，返回 { title, chapters: [{ title, content }] }，
 * 供 book-manage 的「导入书籍」直接保存到群组 book 字段。
 *
 * 识别优先级（与 Python 版一致）：
 *   1. 第 X 章 / 节 / 回 / 篇 / 卷 / 部（中文数字 + 阿拉伯数字）
 *   2. Chapter X / CHAPTER X / chapter X（罗马数字 + 阿拉伯数字）
 *   3. Markdown 标题（# ~ ######）
 *   4. 按空行分段（至少 2 段才算有结构）
 *   5. 按固定字数切分（兜底，尽量在句末断开）
 */

// 中文数字 → 阿拉伯
const CN_DIGITS = { '零': 0, '一': 1, '二': 2, '两': 2, '三': 3, '四': 4,
  '五': 5, '六': 6, '七': 7, '八': 8, '九': 9 };
const CN_UNITS = { '十': 10, '百': 100, '千': 1000, '万': 10000 };

// 章节标题正则（与 Python 版对齐）
const CN_CHAPTER_RE = /^\s*第\s*([零一二三四五六七八九十百千万两0-9]+)\s*([章回节篇卷部])\s*(.*?)\s*$/;
const EN_CHAPTER_RE = /^\s*(?:Chapter|CHAPTER|chapter)\s+([IVXLCDM0-9]+)[:.、\s\-]*(.*?)\s*$/;
const MD_HEADING_RE = /^\s*(#{1,6})\s+(.+?)\s*$/;

/**
 * 中文数字转 int，已是阿拉伯数字则直接返回。
 */
function cnNumToArabic(cn) {
  if (/^\d+$/.test(cn)) return parseInt(cn, 10);
  let total = 0, current = 0;
  for (const ch of cn) {
    if (ch in CN_DIGITS) {
      current = CN_DIGITS[ch];
    } else if (ch in CN_UNITS) {
      if (current === 0) current = 1;
      total += current * CN_UNITS[ch];
      current = 0;
    }
  }
  return total + current;
}

/**
 * 按优先级匹配章节标题。
 * 返回 { kind, raw, num, title } 或 null。
 *   kind: '章'/'回'/'节'/'篇'/'卷'/'部' / 'Chapter' / 'md'
 *   raw:  原始标题前缀（如 "第一章" / "Chapter 1"）
 *   num:  序号或 markdown 标题级别
 *   title:标题正文（可空）
 */
function detectChapter(line) {
  let m = CN_CHAPTER_RE.exec(line);
  if (m) {
    const numStr = m[1], kind = m[2];
    return { kind, raw: `第${numStr}${kind}`, num: cnNumToArabic(numStr), title: (m[3] || '').trim() };
  }
  m = EN_CHAPTER_RE.exec(line);
  if (m) {
    return { kind: 'Chapter', raw: `Chapter ${m[1]}`, num: m[1], title: (m[2] || '').trim() };
  }
  m = MD_HEADING_RE.exec(line);
  if (m) {
    return { kind: 'md', raw: line.trim(), num: m[1].length, title: (m[2] || '').trim() };
  }
  return null;
}

/**
 * 兜底分割：先空行分段，再按字数。
 */
function fallbackSplit(text, size, useEmptyLine) {
  const chapters = [];
  if (useEmptyLine) {
    const blocks = text.trim().split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
    if (blocks.length > 1) {
      blocks.forEach((b, i) => {
        const firstLine = b.split('\n', 1)[0].slice(0, 40);
        chapters.push({ kind: 'empty-line', raw: `段落 ${i + 1}`, num: i + 1, title: firstLine, body: b });
      });
      return chapters;
    }
  }
  size = Math.max(size, 1);
  // 字数兜底：尽量在句末/换行处断开，避免句子被切两半
  let start = 0, idx = 0;
  while (start < text.length) {
    let end = Math.min(start + size, text.length);
    if (end < text.length) {
      const look = text.slice(end, end + 200);
      const m = look.search(/[。！？!?\n]/);
      if (m !== -1) end = end + m + 1;
    }
    idx += 1;
    const body = text.slice(start, end).trim();
    if (body) {
      chapters.push({ kind: 'chunk', raw: `第 ${idx} 段`, num: idx, title: '', body });
    }
    start = end;
  }
  return chapters;
}

/**
 * 解析文本，返回章节列表。
 * 每项: { kind, raw, num, title, body }
 * 首章前的内容（序言）作为单独一项保留。
 */
function parseContent(text, fallbackSize = 1000, useEmptyLine = true) {
  const chapters = [];
  let current = null;
  let buffer = [];

  const flush = () => {
    const body = buffer.join('\n').trim();
    buffer = [];
    if (current !== null) {
      current.body = body;
      chapters.push(current);
    } else if (body) {
      chapters.push({ kind: 'preface', raw: '序言', num: 0, title: '', body });
    }
  };

  for (const line of text.split('\n')) {
    const info = detectChapter(line);
    if (info) {
      flush();
      current = { kind: info.kind, raw: info.raw, num: info.num, title: info.title, body: '' };
    } else {
      buffer.push(line);
    }
  }
  flush();

  if (chapters.length === 0) {
    return fallbackSplit(text, fallbackSize, useEmptyLine);
  }
  return chapters;
}

/**
 * 把章节列表转成群组书籍格式 { title, content }。
 * 标题组合：raw + ' ' + title（与 Python render 对齐）。
 */
function toBookChapters(chapters) {
  return chapters
    .filter(ch => ch.body && ch.body.trim())
    .map(ch => {
      let title = ch.raw;
      if (ch.kind !== 'md' && ch.title) title += ' ' + ch.title;
      // markdown 标题的 raw 本身带 #，去掉前缀再拼
      if (ch.kind === 'md') {
        title = ch.title || ch.raw.replace(/^#+\s*/, '');
      }
      return { title: title.trim(), content: ch.body.trim() };
    });
}

/**
 * 从文件名提取书名。
 */
function extractBookTitle(fileName) {
  let title = fileName.replace(/\.(txt|md|text|epub)$/i, '');
  title = title.replace(/^《|》$/g, '');
  return title || '共读书籍';
}

module.exports = {
  cnNumToArabic,
  detectChapter,
  parseContent,
  fallbackSplit,
  toBookChapters,
  extractBookTitle
};
