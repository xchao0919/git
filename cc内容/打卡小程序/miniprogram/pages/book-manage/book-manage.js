const app = getApp();
const util = require('../../utils/util');

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
        extension: ['txt', 'md', 'text']
      });

      const file = res.tempFiles[0];
      console.log('选择的文件:', file);

      util.showLoading('正在解析文件...');

      // 读取文件内容
      const content = await this.readFileContent(file.path);
      console.log('文件内容长度:', content.length);

      // 解析章节
      const chapters = this.parseChapters(content, file.name);
      console.log('解析出的章节数:', chapters.length);

      if (chapters.length === 0) {
        util.showToast('未识别到章节内容');
        return;
      }

      // 提取书名
      const bookTitle = this.extractBookTitle(file.name);

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

  // 解析章节
  parseChapters(content, fileName) {
    const chapters = [];

    // 尝试多种章节分隔符
    const patterns = [
      /^第[零一二三四五六七八九十百千万\d]+[章节回集篇][\s\S]*?(?=^第[零一二三四五六七八九十百千万\d]+[章节回集篇]|$)/gm,
      /^Chapter\s*\d+[\s\S]*?(?=^Chapter\s*\d+|$)/gim,
      /^CHAPTER\s*\d+[\s\S]*?(?=^CHAPTER\s*\d+|$)/gm,
      /^#+\s*.+[\s\S]*?(?=^#+\s*.+|$)/gm,
    ];

    // 方案1: 使用"第X章"格式
    let matches = content.match(patterns[0]);
    if (matches && matches.length > 0) {
      matches.forEach((match, index) => {
        const lines = match.trim().split('\n');
        const title = lines[0].trim();
        const body = lines.slice(1).join('\n').trim();
        if (body) {
          chapters.push({
            title: title.replace(/^[第\s]+/, '第'),
            content: body
          });
        }
      });
      if (chapters.length > 0) return chapters;
    }

    // 方案2: 使用"Chapter X"格式
    matches = content.match(patterns[1]);
    if (matches && matches.length > 0) {
      matches.forEach((match, index) => {
        const lines = match.trim().split('\n');
        const title = lines[0].trim();
        const body = lines.slice(1).join('\n').trim();
        if (body) {
          chapters.push({ title, content: body });
        }
      });
      if (chapters.length > 0) return chapters;
    }

    // 方案3: 使用 Markdown 标题格式
    matches = content.match(patterns[3]);
    if (matches && matches.length > 0) {
      matches.forEach((match, index) => {
        const lines = match.trim().split('\n');
        const title = lines[0].replace(/^#+\s*/, '').trim();
        const body = lines.slice(1).join('\n').trim();
        if (body) {
          chapters.push({ title, content: body });
        }
      });
      if (chapters.length > 0) return chapters;
    }

    // 方案4: 按空行分割，每段作为一个章节
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim());
    if (paragraphs.length >= 1) {
      // 如果段落太少，按固定字数分割
      if (paragraphs.length < 3) {
        const chunkSize = 2000; // 每章约2000字
        for (let i = 0; i < content.length; i += chunkSize) {
          const chunk = content.slice(i, i + chunkSize).trim();
          if (chunk) {
            chapters.push({
              title: `第 ${Math.floor(i / chunkSize) + 1} 节`,
              content: chunk
            });
          }
        }
      } else {
        paragraphs.forEach((p, index) => {
          if (p.trim().length > 50) { // 忽略太短的段落
            chapters.push({
              title: `第 ${index + 1} 节`,
              content: p.trim()
            });
          }
        });
      }
    }

    return chapters;
  },

  // 提取书名
  extractBookTitle(fileName) {
    // 移除扩展名
    let title = fileName.replace(/\.(txt|md|text)$/i, '');
    // 移除常见前缀
    title = title.replace(/^《|》$/g, '');
    return title || '共读书籍';
  },

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
