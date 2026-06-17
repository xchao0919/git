# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 仓库定位

这是一个 **Obsidian 个人知识管理库**，核心用途是：

- 收集整理 AI 工具教程和学习资料
- 保存 AI 生成的 Excalidraw 图表
- 积累个人创作素材

## 目录结构

| 目录 | 说明 |
|------|------|
| `cc内容/` | AI 整理生成的内容（新建文档存放位置） |
| `Clippings/` | 外部导入内容（视频 / 文章 / 教程） |
| `附件/` | 附件资源（图片、文件等） |
| `附件/excalidraw/` | AI 生成的 Excalidraw 图表 |
| `已归档/` | 已处理完成的原始文件 |
| `docs/` | 说明文档 |
| `knowledge/` | 个人知识库 |
| `skills/` | Claude Code skills 安装目录 |

## Excalidraw 图表保存规范

AI 生成的 Excalidraw 图表必须保存到 `附件/excalidraw/` 目录。

**文件识别方式**：
- 文件扩展名：`.md`（Obsidian excalidraw 插件的存储格式）
- 文件内容特征：包含 `excalidraw-plugin: parsed` 或 `compressed-json` 块
- Frontmatter 标签：包含 `tags: [excalidraw]`

**文件命名规范**：`YYYY-MM-DD-图表描述.excalidraw.md`（保留.md 扩展名）

**使用场景**：
- 流程图（工作流、系统架构）
- 对比图（工具选型、产品对比）
- 思维导图
- 示意图

**示例**：
- `2026-05-12-codex工作流程.excalidraw.md`
- `2026-05-11-AI工具对比.excalidraw.md`

## 文档输出规范

**存放位置**：所有新建文档存放在 `cc内容/` 文件夹中

**作者标注**：frontmatter 中 author 字段统一写 `cc`

```yaml
---
title: "标题"
author: cc
url: "来源链接"
created: YYYY-MM-DD
tags: [标签1, 标签2]
---
```

## 内容处理能力

当用户提供内容时，自动识别意图并处理：

| 意图 | 输出 |
| ------ | ------------------- |
| 英文内容翻译 | 原文 + 翻译 + 要点总结 |
| 整理混乱笔记 | 结构化 Markdown + 核心要点 |
| 内容创作需求 | 选题定位 + 内容结构 + 脚本 |
| 中英混杂优化 | 统一中文 + 流畅表达 |

## 常用标签

- `clippings` — 外部导入内容
- `OpenClaw` / `Claude Code` / `AI工具` — 主题分类
- `翻译` / `整理` — 处理状态

## 翻译格式化规范

翻译并整理外部内容（如 YouTube 视频、博客文章等）时，必须遵循以下规范：

### 语言要求

- **必须使用简体中文**，禁止使用繁体字
- 所有正文内容、表格、标题都要用简体字

### 详细程度要求

翻译要详细完整，不要只做概要：

- 问题背景和原因要解释清楚
- 概念和机制要详细说明
- 示例和场景要完整翻译
- 技术细节不能省略
- 保留原始的时间戳、章节标题、关键引述

### 格式规范

| 元素 | 格式要求 |
|------|----------|
| 结构化信息 | 使用表格（如时间戳、配置项、对比表） |
| 命令代码 | 使用代码块（```） |
| 关键引述 | 使用引用块（>） |
| 层级标题 | 使用 ## 和 ### 分级 |

### Frontmatter 模板

```yaml
---
title: "标题"
author: cc
url: "来源链接"
created: YYYY-MM-DD
tags: [标签1, 标签2]
---
```

### 文件命名规范

- 格式：`MM-DD-描述名称.md`
- 示例：`03-26-Claude Cowork 17个最佳实践.md`

### 输出位置

- 统一保存到 `cc内容/` 目录
- 不保存到其他位置

### 翻译流程

1. 在 `Clippings/` 目录找到原始文件
2. 完整阅读原文内容
3. 按规范翻译为简体中文
4. 保存到 `cc内容/` 目录
5. **归档处理**：
   - 将原文章移动到 `已归档/` 文件夹
   - 重命名原文件，标题前加上处理日期，格式：`YYYY-MM-DD-原标题.md`

## 常用工具链接

- DeepSeek API：https://platform.deepseek.com/api_keys
- CCSwitch：https://ccswitch.io/zh/
- Claude Code 文档：https://code.claude.com/docs/zh-CN/overview
- Claudian：https://github.com/YishenTu/claudian
- Excalidraw：https://excalidraw.com/
- Obsidian Web Clipper：https://obsidian.md/zh/clipper
