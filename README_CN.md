# prism-latex

**面向 [DeepSeek Harness](https://github.com/deepseek-ai) 的 LaTeX 预览：模型写 `.tex`，你在源码旁边直接看到编译好的页面。**

这个 bundle 用你本机的 TeX Live 编译 `.tex`，把页面显示在 DSH 里——右侧栏，以及一个带大纲、编辑器和预览的 `LaTeX` 视图。双击页面上的任意位置，光标就落到那个字符上。

[English](README.md) · **中文**

![LaTeX 视图：大纲栏、源码编辑器、渲染页面](docs/view.png)

## 快速开始

1. **安装**（见下），然后**完全退出并重开** DSH。
2. 打开任意 `.tex`——模型给的文件链接、文件树里的都行。它会在右侧栏打开并编译。
3. 想改稿，把对话的视图行切到 **LaTeX**。它编辑的就是右侧栏正在显示的那个文件。
4. 双击渲染页面上的某处，光标跳到对应字符。

手边没有 `.tex`？打开 `demo/showcase.tex`：标题、摘要、章节、公式、表格，两页。

## 安装

需要 DSH 桌面版、本机 TeX Live（`latexmk` 或 `pdflatex`；要中文就装 `xelatex`）、以及渲染页面用的 Ghostscript。

把 bundle 加进 DSH profile，然后重启应用：

```jsonc
// ~/.dsh/profiles/<profile>/package.json
{
  "dependencies": { "prism-latex": "^0.2.0" },
  "dsh": { "profile": { "bundles": ["prism-latex"] } }
}
```

```bash
cd ~/.dsh/profiles/<profile> && pnpm install
```

在改这个插件本身？把依赖写成 `"prism-latex": "link:/path/to/checkout"`。客户端代码每次启动只加载一次：**必须完全退出再打开**，`⌘R` 拿不到新字节。

## 你会得到

| | |
|---|---|
| **右侧栏 tab** | 阅读面。编译你打开的文件；页面栈、适应宽度与最高 300% 缩放、引擎选择、Preview / Source / Side by side、下载 PDF，报错带可点的行号。 |
| **`LaTeX` 视图** | 写作面。大纲栏（可拖宽、可隐藏）、带 LaTeX 高亮的编辑器、眼睛开关后的可选预览，下面是 shell 原生 composer。 |

<p>
  <img src="docs/preview.png" width="420" alt="右侧栏：页面栈与引擎选择" />
  <img src="docs/editor.png" width="420" alt="编辑器：语法高亮与吸顶章节标题" />
</p>

## 快捷键

| 按键 | 作用 |
|---|---|
| `⌘S` | 保存并重新编译 |
| `⌘↩` | 编译 |
| `⌘F` / `⌘G` | 查找替换 / 跳到行 |
| `⌘=` `⌘−` `⌘0` | 编辑器字号（10–20 px），会记住 |
| `⌘`/Ctrl + 滚轮 | 缩放渲染页面 |

## 已知限制

- 反向搜索可用（页面 → 光标），正向搜索（光标 → 页面）还没做。
- 没有自动换行：长行横向滚动。
- 入口只有一个——`LaTeX` 视图；左侧栏图标和 `main` 面板是刻意移除的。

## 开发

```bash
node --check src/host.js && node --check src/client.js
node scripts/smoke-host.mjs
PRISMLX_REACT_PATH="$DSH_PROFILE_DIR/node_modules/react" node scripts/smoke-client.mjs
node scripts/check-pairing.mjs
```

三套测试跑在 DSH 的替身上下文里：它们覆盖插件本身，覆盖不了 dock。任何动到 tab、对话视图或滚动的改动，都要真机重启验一次。`CLAUDE.md` 是规则，`POSTMORTEM.md` 是这八次回退的来龙去脉，`SPEC.md` 是设计说明，[`docs/architecture.svg`](docs/architecture.svg) 是两半的图。

## 出处与许可

产品思路——带实时预览的 AI LaTeX 编辑器——来自
[assistant-ui/open-prism](https://github.com/assistant-ui/open-prism)。这里是面向 DSH 插件 API 的独立实现，不是 fork；借用的行为都写在代码和
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) 里。

MIT — [`LICENSE`](LICENSE)。[贡献指南](CONTRIBUTING.md) · [更新日志](CHANGELOG.md)
