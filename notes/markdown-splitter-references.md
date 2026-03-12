# Markdown Splitter 参考

更新时间：2026-03-12

## 背景

当前 `timbot` 的问题是“消息体超长时如何拆成多条消息，同时尽量不破坏 Markdown 显示”。

短期方案可以先参考 `sliverp/qqbot` 的轻量切分方式：

- 超过上限后优先按换行切
- 换行不合适时按空格切
- 还不行就按固定长度硬切

这能比纯定长切分更自然，但它不是 Markdown-aware splitter，仍然可能切坏：

- fenced code block
- 表格
- 列表缩进
- 引用块
- 行内链接/图片

## 可以放心用作底座的库

### 1. remark / unified

- 主页：[remark](https://github.com/remarkjs/remark)
- 适合场景：把 Markdown 解析为 AST，再按 block 级结构切分，最后重新输出 Markdown
- 判断：这是 Node / TypeScript 生态里最成熟、最稳妥的选择

### 2. mdast-util-from-markdown

- 主页：[mdast-util-from-markdown](https://github.com/syntax-tree/mdast-util-from-markdown)
- 作用：把 Markdown 解析成 `mdast`
- 判断：如果要自己写“按标题、段落、列表、代码块、表格切分”的规则，这是合适底座

### 3. mdast-util-to-markdown

- 主页：[mdast-util-to-markdown](https://github.com/syntax-tree/mdast-util-to-markdown)
- 作用：把切分后的 AST 再序列化回 Markdown
- 判断：比自己手拼字符串更安全，能减少格式被破坏的风险

### 4. mdast-util-gfm

- 主页：[mdast-util-gfm](https://github.com/syntax-tree/mdast-util-gfm)
- 作用：支持 GFM 语法，例如表格、任务列表、删除线
- 判断：如果聊天内容里会出现 Markdown 表格，这个基本是必要的

### 5. commonmark.js

- 主页：[commonmark.js](https://github.com/commonmark/commonmark.js)
- 作用：CommonMark 参考实现之一
- 判断：成熟可用，但在 Node / TS 里做“修改结构再输出 Markdown”时，开发体验通常不如 remark 生态

### 6. markdown-it

- 主页：[markdown-it](https://github.com/markdown-it/markdown-it)
- 作用：成熟的 Markdown 解析与渲染器
- 判断：更偏渲染/token 流，不是最适合做“AST 结构切分再重组”的底座

## 可以参考思路，但不建议直接拿来落地的 splitter

### 1. LangChain Markdown splitter

- 文档：[MarkdownHeaderTextSplitter](https://docs.langchain.com/oss/python/integrations/splitters/markdown_header_metadata_splitter)
- 判断：适合参考“先按标题切，再按子块细分”的思路
- 风险：它主要面向 RAG chunking，不保证每段都是可独立渲染的聊天消息

### 2. LangChain RecursiveCharacterTextSplitter

- 文档：[Code and Markdown splitting](https://docs.langchain.com/oss/javascript/integrations/splitters/code_splitter)
- 判断：适合参考“优先按语义分隔符递归切分”的思路
- 风险：本质仍偏文本切块，不是严格的 Markdown 结构保护

### 3. text-splitter / MarkdownSplitter

- 主页：[text-splitter](https://github.com/benbrandt/text-splitter)
- 判断：方向是对的，强调按 Markdown / CommonMark 结构切分
- 风险：主生态不在当前项目使用的 Node / TypeScript 插件链路里，直接接入成本偏高

### 4. mdast-util-split-by-heading

- 页面：[mdast-util-split-by-heading](https://www.npmjs.com/package/mdast-util-split-by-heading)
- 判断：适合“按标题拆章节”
- 风险：过于单点，不解决代码块、表格、列表跨段切分问题

### 5. @breakup/markdown

- 页面：[@breakup/markdown](https://www.npmjs.com/package/@breakup/markdown)
- 判断：方向正确，偏 AST-aware 的 chunking
- 风险：相对较新，更适合作为实现参考，不建议直接作为生产核心依赖

## 值得参考的文章

### Pinecone: Chunking Strategies for LLM Applications

- 链接：[Chunking strategies](https://www.pinecone.io/learn/chunking-strategies/)
- 价值：虽然不是专门讲 Markdown，但把 fixed-size chunking 和 content-aware chunking 的取舍解释得很清楚
- 对当前项目的启发：`timbot` 现在做的是 fixed-size / near-fixed-size 分段；如果后续要保护 Markdown 结构，就要向 content-aware chunking 演进

## 对 timbot 的建议

### 短期

先采用 `qqbot` 风格切分：

- 优先换行
- 其次空格
- 最后硬切

优点：

- 不引入新依赖
- 实现简单
- 对普通段落类文本比纯定长切分更自然

局限：

- 不是 Markdown-aware
- 代码块、表格、嵌套列表仍可能被切坏

### 中期

如果要真正减少 Markdown 损坏，建议做一个“轻量 Markdown-aware splitter”：

1. 用 `remark` / `mdast-util-from-markdown` 解析
2. 先按 block 级节点切：标题、段落、列表、引用、代码块、表格
3. 单个 block 超限时，再对该 block 做专门降级切分
4. 用 `mdast-util-to-markdown` 输出

这个方案的核心不是“自己造 parser”，而是基于成熟 parser 实现项目自己的消息分段策略。
