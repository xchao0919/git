#!/usr/bin/env python3
"""
文本处理工具
将 txt / epub / mobi / azw3 / jpeg 等文件按章节规则分割，输出 txt 或 md 格式。

章节识别规则（按优先级）：
  1. 第 X 章 / 第 X 节 / 第 X 回 / 第 X 篇 / 第 X 卷 / 第 X 部
  2. Chapter X / CHAPTER X / chapter X
  3. Markdown 标题（# 开头）
  4. 按空行分割
  5. 按固定字数分割（兜底）

外部依赖（按需）：
  - .mobi / .azw3：需要 Calibre（ebook-convert 命令）
  - .jpeg / .jpg：需要 Tesseract OCR（tesseract 命令）
"""

import argparse
import re
import subprocess
import sys
import tempfile
import zipfile
from html.parser import HTMLParser
from pathlib import Path

SUPPORTED_EXTS = ('.txt', '.epub', '.mobi', '.azw3', '.jpeg', '.jpg')


def read_text_auto(path):
    """自动探测编码读取文本：UTF-8 BOM → UTF-8 → GBK → 容错 UTF-8。"""
    data = Path(path).read_bytes()
    if data.startswith(b'\xef\xbb\xbf'):
        return data[3:].decode('utf-8', errors='replace')
    for enc in ('utf-8', 'gbk', 'gb18030', 'big5'):
        try:
            return data.decode(enc)
        except UnicodeDecodeError:
            continue
    return data.decode('utf-8', errors='replace')


# ============== 各格式文本提取 ==============

class _HTMLToText(HTMLParser):
    """简易 HTML → 纯文本转换器。"""

    BLOCK_TAGS = {'p', 'div', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                  'li', 'tr', 'section', 'article', 'header', 'footer'}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.skip = False

    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style', 'head'):
            self.skip = True
        if tag in self.BLOCK_TAGS:
            self.parts.append('\n')

    def handle_endtag(self, tag):
        if tag in ('script', 'style', 'head'):
            self.skip = False
        if tag in self.BLOCK_TAGS:
            self.parts.append('\n')

    def handle_data(self, data):
        if not self.skip:
            self.parts.append(data)


def _html_to_text(html):
    parser = _HTMLToText()
    parser.feed(html)
    text = ''.join(parser.parts)
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r'\n[ \t]+', '\n', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def extract_epub(path):
    """从 epub 提取纯文本。epub 本质是 zip + XHTML。"""
    parts = []
    with zipfile.ZipFile(path) as z:
        names = [n for n in z.namelist()
                 if n.lower().endswith(('.xhtml', '.html', '.htm'))]
        names.sort()
        for name in names:
            try:
                raw = z.read(name)
            except Exception:
                continue
            html = raw.decode('utf-8', errors='replace')
            text = _html_to_text(html)
            if text:
                parts.append(text)
    return '\n\n'.join(parts)


def _check_command(cmd):
    """检查命令是否可用，返回 True/False。"""
    try:
        subprocess.run([cmd, '--version'], capture_output=True, check=False)
        return True
    except FileNotFoundError:
        return False


def extract_via_calibre(path):
    """用 Calibre 的 ebook-convert 把 mobi/azw3 转成 txt。"""
    if not _check_command('ebook-convert'):
        sys.exit(
            '错误：转换 .mobi / .azw3 需要安装 Calibre 并将其加入 PATH。\n'
            '  下载：https://calibre-ebook.com/download\n'
            '  安装后在 Calibre 安装目录中找到 ebook-convert.exe，\n'
            '  把该目录加入系统环境变量 PATH 即可。'
        )
    with tempfile.NamedTemporaryFile(suffix='.txt', delete=False) as tf:
        out_path = tf.name
    try:
        proc = subprocess.run(
            ['ebook-convert', str(path), out_path],
            capture_output=True, text=True, encoding='utf-8', errors='replace'
        )
        if proc.returncode != 0:
            sys.exit(f'错误：Calibre 转换失败：\n{proc.stderr or proc.stdout}')
        return read_text_auto(out_path)
    finally:
        Path(out_path).unlink(missing_ok=True)


def extract_via_tesseract(path):
    """用 Tesseract OCR 从图片提取文字。"""
    if not _check_command('tesseract'):
        sys.exit(
            '错误：从图片提取文字需要安装 Tesseract OCR 并将其加入 PATH。\n'
            '  下载：https://github.com/UB-Mannheim/tesseract/wiki\n'
            '  安装时请勾选中文语言包（chi_sim）。\n'
            '  安装后把 Tesseract 安装目录加入系统环境变量 PATH。'
        )
    proc = subprocess.run(
        ['tesseract', str(path), '-', '-l', 'chi_sim+eng'],
        capture_output=True, text=True, encoding='utf-8', errors='replace'
    )
    if proc.returncode != 0:
        sys.exit(f'错误：Tesseract OCR 失败：\n{proc.stderr}')
    return proc.stdout


def extract_text(path):
    """根据扩展名调度对应的提取器，返回纯文本。"""
    ext = Path(path).suffix.lower()
    if ext == '.txt':
        return read_text_auto(path)
    if ext == '.epub':
        return extract_epub(path)
    if ext in ('.mobi', '.azw3'):
        return extract_via_calibre(path)
    if ext in ('.jpg', '.jpeg'):
        return extract_via_tesseract(path)
    sys.exit(f'错误：不支持的格式 {ext}，仅支持 {", ".join(SUPPORTED_EXTS)}')

CN_CHAPTER_RE = re.compile(
    r'^\s*第\s*([零一二三四五六七八九十百千万两0-9]+)\s*([章回节篇卷部])\s*(.*?)\s*$'
)
EN_CHAPTER_RE = re.compile(
    r'^\s*(?:Chapter|CHAPTER|chapter)\s+([IVXLCDM0-9]+)[:.、\s\-]*(.*?)\s*$'
)
MD_HEADING_RE = re.compile(r'^\s*(#{1,6})\s+(.+?)\s*$')

CN_DIGITS = {'零': 0, '一': 1, '二': 2, '两': 2, '三': 3, '四': 4,
             '五': 5, '六': 6, '七': 7, '八': 8, '九': 9}
CN_UNITS = {'十': 10, '百': 100, '千': 1000, '万': 10000}


def cn_num_to_arabic(cn: str):
    """中文数字转 int（已是阿拉伯数字则直接返回）。"""
    if cn.isdigit():
        return int(cn)
    total, current = 0, 0
    for ch in cn:
        if ch in CN_DIGITS:
            current = CN_DIGITS[ch]
        elif ch in CN_UNITS:
            if current == 0:
                current = 1
            total += current * CN_UNITS[ch]
            current = 0
    return total + current


def detect_chapter(line: str):
    """
    按优先级匹配章节标题。
    返回 (kind, raw, num, title) 或 None。
        kind: 章/回/节/篇/卷/部 / 'Chapter' / 'md'
        raw:  原始标题文本（去首尾空白）
        num:  序号或等级
        title:标题正文
    """
    m = CN_CHAPTER_RE.match(line)
    if m:
        num_str, kind = m.group(1), m.group(2)
        return kind, f'第{num_str}{kind}', cn_num_to_arabic(num_str), m.group(3).strip()
    m = EN_CHAPTER_RE.match(line)
    if m:
        return 'Chapter', f'Chapter {m.group(1)}', m.group(1), m.group(2).strip()
    m = MD_HEADING_RE.match(line)
    if m:
        return 'md', m.group(0).strip(), len(m.group(1)), m.group(2).strip()
    return None


def parse_content(text, fallback_size=1000, use_empty_line=True):
    """
    解析文本，返回章节列表。
    每项: {'kind', 'raw', 'num', 'title', 'body'}
    首章前的内容（序言）作为单独一项保留。
    """
    chapters = []
    current = None
    buffer = []

    def flush():
        nonlocal buffer
        body = '\n'.join(buffer).strip()
        buffer = []
        if current is not None:
            current['body'] = body
            chapters.append(current)
        elif body:
            chapters.append({'kind': 'preface', 'raw': '序言', 'num': 0,
                             'title': '', 'body': body})

    for line in text.split('\n'):
        info = detect_chapter(line)
        if info:
            flush()
            kind, raw, num, title = info
            current = {'kind': kind, 'raw': raw, 'num': num,
                       'title': title, 'body': ''}
        else:
            buffer.append(line)
    flush()

    if not chapters:
        chapters = fallback_split(text, fallback_size, use_empty_line)
    return chapters


def fallback_split(text, size, use_empty_line):
    """兜底分割：先空行，再字数。"""
    chapters = []
    if use_empty_line:
        blocks = [b.strip() for b in re.split(r'\n\s*\n', text.strip()) if b.strip()]
        if len(blocks) > 1:
            for i, b in enumerate(blocks, 1):
                first_line = b.split('\n', 1)[0][:40]
                chapters.append({'kind': 'empty-line', 'raw': f'段落 {i}',
                                 'num': i, 'title': first_line, 'body': b})
            return chapters
    size = max(size, 1)
    for i in range(0, len(text), size):
        idx = i // size + 1
        chapters.append({'kind': 'chunk', 'raw': f'第 {idx} 段',
                         'num': idx, 'title': '', 'body': text[i:i + size]})
    return chapters


def render_md(chapters):
    out = []
    for ch in chapters:
        if ch['kind'] == 'md':
            heading = ch['raw']
        elif ch['kind'] == 'Chapter':
            heading = f"## {ch['raw']}"
            if ch['title']:
                heading += f" - {ch['title']}"
        elif ch['kind'] in ('章', '回', '节', '篇', '卷', '部'):
            heading = f"## {ch['raw']}"
            if ch['title']:
                heading += f" {ch['title']}"
        else:
            heading = f"## {ch['raw']}"
            if ch['title']:
                heading += f" {ch['title']}"
        out.append(heading)
        out.append('')
        if ch['body']:
            out.append(ch['body'])
            out.append('')
    return '\n'.join(out).rstrip() + '\n'


def render_txt(chapters):
    sep = '\n\n' + '=' * 40 + '\n\n'
    parts = []
    for ch in chapters:
        head = ch['raw']
        if ch['kind'] != 'md' and ch['title']:
            head += ' ' + ch['title']
        parts.append(head + '\n' + '-' * 40 + '\n' + (ch['body'] or ''))
    return sep.join(parts).rstrip() + '\n'


def main():
    parser = argparse.ArgumentParser(
        description='将 txt/epub/mobi/azw3/jpeg 文件按章节规则分割，输出 txt 或 md')
    parser.add_argument('input', help=f'输入文件路径（支持 {", ".join(SUPPORTED_EXTS)}）')
    parser.add_argument('-f', '--format', choices=['md', 'txt'], default='md',
                        help='输出格式，默认 md')
    parser.add_argument('-o', '--output', help='输出文件路径（默认与输入同目录、同文件名）')
    parser.add_argument('--chunk-size', type=int, default=1000,
                        help='兜底按字数分割时的字数，默认 1000')
    parser.add_argument('--no-empty-line', action='store_true',
                        help='禁用空行兜底分割，直接按字数切')
    args = parser.parse_args()

    inp = Path(args.input)
    if not inp.exists():
        sys.exit(f'错误：文件不存在 - {inp}')
    if inp.suffix.lower() not in SUPPORTED_EXTS:
        sys.exit(f'错误：不支持的格式 {inp.suffix}，仅支持 {", ".join(SUPPORTED_EXTS)}')

    text = extract_text(inp)
    chapters = parse_content(text, args.chunk_size, not args.no_empty_line)

    if args.format == 'md':
        result, suffix = render_md(chapters), '.md'
    else:
        result, suffix = render_txt(chapters), '.txt'

    out = Path(args.output) if args.output else inp.with_suffix(suffix)
    out.write_text(result, encoding='utf-8')
    print(f'已处理 {len(chapters)} 个章节 → {out}')


if __name__ == '__main__':
    main()
