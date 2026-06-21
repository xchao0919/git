const app = getApp();
const util = require('../../utils/util');
const textParser = require('../../utils/text-parser');

// jszip 依赖 setImmediate，小程序里没有，必须在 require jszip 前补上
(function () {
  const root = (typeof globalThis !== 'undefined') ? globalThis
            : (typeof global !== 'undefined') ? global
            : (typeof window !== 'undefined') ? window
            : this;
  if (typeof root.setImmediate !== 'function') {
    const map = {};
    let nextId = 1;
    root.setImmediate = function (fn) {
      const args = Array.prototype.slice.call(arguments, 1);
      const id = nextId++;
      map[id] = setTimeout(function () {
        delete map[id];
        try { fn.apply(null, args); } catch (e) { console.error(e); }
      }, 0);
      return id;
    };
    root.clearImmediate = function (id) {
      if (map[id]) { clearTimeout(map[id]); delete map[id]; }
    };
  }
})();

const JSZip = require('../../libs/jszip.min.js');

Page({
  data: {
    groupId: '',
    bookInfo: null,
    chapters: [],
    displayChapters: [],
    pageSize: 20,
    currentPage: 1,
    hasMore: true,
    editingChapter: null,
    showChapterModal: false,
    showImportModal: false,
    loading: true,
    chapterForm: {
      title: '',
      content: ''
    }
  },

  onLoad(options) {
    console.log('book-manage onLoad, options:', options);
    const { groupId } = options;
    if (groupId) {
      this.setData({ groupId });
      this.loadBookInfo();
    } else {
      console.error('groupId is missing in options');
      util.showToast('参数错误');
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },

  // 加载书籍信息
  async loadBookInfo() {
    try {
      this.setData({ loading: true });

      const { groupId } = this.data;

      // 使用 getBook 接口获取书籍元信息
      const { result } = await wx.cloud.callFunction({
        name: 'group',
        data: {
          action: 'getBook',
          data: { groupId }
        }
      });

      if (result.code === 0 && result.data) {
        const bookInfo = result.data;

        // 如果有章节列表（标题），初始化章节数组
        if (bookInfo.chapters && bookInfo.chapters.length > 0) {
          const chapters = bookInfo.chapters.map(ch => ({
            title: ch.title,
            content: null // 内容稍后加载
          }));

          this.setData({
            bookInfo: { title: bookInfo.title, chapterCount: chapters.length },
            chapters,
            currentPage: 1,
            hasMore: chapters.length > 20,
            loading: false
          });
          this.updateDisplayChapters();

          // 后台加载前20章的内容
          const loadCount = Math.min(20, chapters.length);
          for (let i = 0; i < loadCount; i++) {
            await this.loadSingleChapter(i);
          }
        } else {
          this.setData({
            bookInfo: { title: bookInfo.title, chapterCount: bookInfo.chapterCount || 0 },
            chapters: [],
            loading: false
          });
        }
      } else {
        this.setData({
          bookInfo: null,
          chapters: [],
          loading: false
        });
      }
    } catch (err) {
      console.error('加载书籍信息失败：', err);
      util.showToast('加载失败');
      this.setData({ loading: false });
    }
  },

  // 加载单个章节
  async loadSingleChapter(chapterIndex) {
    const { groupId, chapters } = this.data;

    try {
      const { result } = await wx.cloud.callFunction({
        name: 'group',
        data: {
          action: 'getBook',
          data: { groupId, chapterIndex }
        }
      });

      if (result.code === 0 && result.data.chapter) {
        chapters[chapterIndex] = result.data.chapter;
        this.setData({ chapters });
        this.updateDisplayChapters();
      }
    } catch (err) {
      console.error(`加载第${chapterIndex + 1}章失败：`, err);
    }
  },

  // 更新显示的章节
  updateDisplayChapters() {
    const { chapters, pageSize, currentPage } = this.data;
    const start = 0;
    const end = currentPage * pageSize;
    const displayChapters = chapters.slice(start, end).map((chapter, i) => ({
      ...chapter,
      originalIndex: i
    })).filter(ch => ch !== null && ch.title);
    this.setData({
      displayChapters
    });
  },

  // 加载更多章节
  async loadMoreChapters() {
    const { chapters, pageSize, currentPage, hasMore, groupId } = this.data;
    if (!hasMore) return;

    const newPage = currentPage + 1;
    const start = currentPage * pageSize;
    const end = Math.min(newPage * pageSize, chapters.length);

    this.setData({ currentPage: newPage });

    // 加载新页面的章节
    for (let i = start; i < end; i++) {
      if (!chapters[i]) {
        await this.loadSingleChapter(i);
      }
    }

    this.setData({ hasMore: end < chapters.length });
  },

  // 显示导入弹窗
  showImportModal() {
    this.setData({ showImportModal: true });
  },

  // 隐藏导入弹窗
  hideImportModal() {
    this.setData({ showImportModal: false });
  },

  // 从文件导入
  async importFromFile() {
    try {
      // 选择文件
      const res = await wx.chooseMessageFile({
        count: 1,
        type: 'file',
        extension: ['txt', 'md', 'text', 'epub']
      });

      const file = res.tempFiles[0];
      console.log('选择的文件:', file);

      util.showLoading('正在解析文件...');

      // 根据扩展名提取纯文本
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      let rawText;
      if (ext === 'epub') {
        rawText = await this.extractEpubText(file.path);
      } else {
        rawText = await this.readFileContent(file.path);
      }
      console.log('文件内容长度:', rawText.length);

      // 统一换行符
      const text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

      // 解析章节（移植自 text_tool.py）
      const parsed = textParser.parseContent(text, 1000, true);
      const chapters = textParser.toBookChapters(parsed);
      console.log('解析出的章节数:', chapters.length);

      if (chapters.length === 0) {
        util.showToast('未识别到章节内容');
        return;
      }

      // 提取书名
      const bookTitle = textParser.extractBookTitle(file.name);

      // 保存书籍
      await this.saveBook(bookTitle, chapters);

      // 更新本地数据
      const newBookInfo = { title: bookTitle, chapterCount: chapters.length };
      this.setData({
        bookInfo: newBookInfo,
        chapters: chapters,
        currentPage: 1,
        hasMore: chapters.length > 20
      });
      this.updateDisplayChapters();
      this.setData({ showImportModal: false });

      util.showToast(`导入成功，共 ${chapters.length} 章`, 'success');

    } catch (err) {
      console.error('导入文件失败:', err);
      util.showToast('导入失败: ' + (err.message || '未知错误'));
    } finally {
      util.hideLoading();
    }
  },

  // 从 epub 提取纯文本（zip + XHTML）
  async extractEpubText(filePath) {
    const fs = wx.getFileSystemManager();
    const buf = await new Promise((resolve, reject) => {
      fs.readFile({
        filePath,
        success: (res) => resolve(res.data),
        fail: (err) => reject(new Error('读取 epub 失败：' + (err.errMsg || '')))
      });
    });

    console.log('epub buf 类型:', Object.prototype.toString.call(buf), '长度:', buf && buf.byteLength);

    // jszip 在小程序里对 Uint8Array 兼容性更好
    const uint8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    const zip = await JSZip.loadAsync(uint8);

    const names = Object.keys(zip.files)
      .filter(n => /\.(xhtml|html|htm)$/i.test(n) && !zip.files[n].dir)
      .sort();

    if (names.length === 0) {
      throw new Error('epub 内未找到 XHTML/HTML 文件');
    }

    const parts = [];
    for (const name of names) {
      const html = await zip.files[name].async('string');
      const text = this.htmlToText(html);
      if (text) parts.push(text);
    }
    return parts.join('\n\n');
  },

  // 简易 HTML → 纯文本
  htmlToText(html) {
    // 去 script/style/head
    html = html.replace(/<script[\s\S]*?<\/script>/gi, '')
               .replace(/<style[\s\S]*?<\/style>/gi, '')
               .replace(/<head[\s\S]*?<\/head>/gi, '');
    // block 标签前后加换行
    html = html.replace(/<\/?(p|div|br|h[1-6]|li|tr|section|article|header|footer|blockquote)[^>]*>/gi, '\n');
    // 去所有标签
    html = html.replace(/<[^>]+>/g, '');
    // 解码常见 HTML 实体
    html = html.replace(/&nbsp;/g, ' ')
               .replace(/&amp;/g, '&')
               .replace(/&lt;/g, '<')
               .replace(/&gt;/g, '>')
               .replace(/&quot;/g, '"')
               .replace(/&#39;/g, "'");
    // 压缩空白
    html = html.replace(/[ \t]+/g, ' ')
               .replace(/\n[ \t]+/g, '\n')
               .replace(/\n{3,}/g, '\n\n');
    return html.trim();
  },

  // 读取文件内容
  readFileContent(filePath) {
    return new Promise((resolve, reject) => {
      const fs = wx.getFileSystemManager();
      fs.readFile({
        filePath: filePath,
        encoding: 'utf-8',
        success: (res) => {
          resolve(res.data);
        },
        fail: (err) => {
          // 尝试其他编码
          fs.readFile({
            filePath: filePath,
            encoding: 'gbk',
            success: (res) => resolve(res.data),
            fail: () => reject(new Error('无法读取文件'))
          });
        }
      });
    });
  },

  // 解析章节与提取书名的逻辑已迁移到 utils/text-parser.js

  // 保存书籍
  async saveBook(title, chapters) {
    const { groupId } = this.data;

    if (!groupId) {
      throw new Error('群组ID不存在，请重新进入页面');
    }

    const bookData = {
      title,
      chapters
    };

    const { result } = await wx.cloud.callFunction({
      name: 'group',
      data: {
        action: 'update',
        data: {
          groupId,
          book: bookData
        }
      }
    });

    if (result.code !== 0) {
      throw new Error(result.message || '保存失败');
    }

    return bookData;
  },

  // 显示添加章节弹窗
  showAddChapterModal() {
    this.setData({
      showChapterModal: true,
      editingChapter: null,
      chapterForm: {
        title: '',
        content: ''
      }
    });
  },

  // 显示编辑章节弹窗
  async editChapter(e) {
    const { index } = e.currentTarget.dataset;
    let chapter = this.data.chapters[index];

    // 如果章节未加载，先加载
    if (!chapter) {
      await this.loadSingleChapter(index);
      chapter = this.data.chapters[index];
    }

    this.setData({
      showChapterModal: true,
      editingChapter: index,
      chapterForm: {
        title: chapter?.title || '',
        content: chapter?.content || ''
      }
    });
  },

  // 关闭章节弹窗
  closeChapterModal() {
    this.setData({ showChapterModal: false, editingChapter: null });
  },

  // 输入章节标题
  handleTitleInput(e) {
    this.setData({ 'chapterForm.title': e.detail.value });
  },

  // 输入章节内容
  handleContentInput(e) {
    this.setData({ 'chapterForm.content': e.detail.value });
  },

  // 保存章节
  async saveChapter() {
    const { chapterForm, editingChapter, chapters, bookInfo } = this.data;

    if (!chapterForm.title.trim()) {
      util.showToast('请输入章节标题');
      return;
    }

    if (!chapterForm.content.trim()) {
      util.showToast('请输入章节内容');
      return;
    }

    try {
      util.showLoading('保存中...');

      let newChapters = [...chapters];
      const chapterData = {
        title: chapterForm.title.trim(),
        content: chapterForm.content.trim()
      };

      if (editingChapter !== null) {
        newChapters[editingChapter] = chapterData;
      } else {
        newChapters.push(chapterData);
      }

      await this.saveBook(bookInfo?.title || '共读书籍', newChapters);

      this.setData({
        chapters: newChapters,
        showChapterModal: false,
        editingChapter: null
      });
      this.updateDisplayChapters();

      util.showToast('保存成功', 'success');
    } catch (err) {
      console.error('保存章节失败：', err);
      util.showToast('保存失败');
    } finally {
      util.hideLoading();
    }
  },

  // 删除章节
  async deleteChapter(e) {
    const { index } = e.currentTarget.dataset;
    const confirmed = await util.showConfirm('确认删除', '确定要删除这个章节吗？');
    if (!confirmed) return;

    try {
      util.showLoading('删除中...');

      const { chapters, bookInfo } = this.data;
      const newChapters = chapters.filter((_, i) => i !== index);
      await this.saveBook(bookInfo?.title || '共读书籍', newChapters);

      this.setData({ chapters: newChapters });
      this.updateDisplayChapters();
      util.showToast('删除成功', 'success');
    } catch (err) {
      console.error('删除章节失败：', err);
      util.showToast('删除失败');
    } finally {
      util.hideLoading();
    }
  },

  // 修改书名
  editBookTitle() {
    wx.showModal({
      title: '修改书名',
      editable: true,
      placeholderText: '请输入书名',
      content: this.data.bookInfo?.title || '',
      success: async (res) => {
        if (res.confirm && res.content) {
          try {
            const { chapters, bookInfo } = this.data;
            await this.saveBook(res.content.trim(), chapters);
            this.setData({ 'bookInfo.title': res.content.trim() });
            util.showToast('修改成功', 'success');
          } catch (err) {
            util.showToast('修改失败');
          }
        }
      }
    });
  },

  // 删除书籍
  async deleteBook() {
    const confirmed = await util.showConfirm('确认删除', '删除书籍后，所有章节将被清除，确定要删除吗？');
    if (!confirmed) return;

    try {
      util.showLoading('删除中...');

      const { groupId } = this.data;

      const { result } = await wx.cloud.callFunction({
        name: 'group',
        data: {
          action: 'update',
          data: {
            groupId,
            book: null
          }
        }
      });

      if (result.code === 0) {
        this.setData({ bookInfo: null, chapters: [] });
        util.showToast('删除成功', 'success');
      }
    } catch (err) {
      console.error('删除书籍失败：', err);
      util.showToast('删除失败');
    } finally {
      util.hideLoading();
    }
  }
});
