# 竖装选字复制（Column Select Copy）

一个 DSH（DeepSeek Harness）Web 客户端插件：按住 **Alt** 用鼠标左键拖出矩形选框，松开后自动复制框内所有文本，并弹出轻量提示。

适合从对话、代码块或表格里按列摘取内容，而不必逐行拖选。

## 功能

- **Alt + 左键拖拽**：在对话正文区域画出矩形（块/列）选框
- **松开即复制**：提取选框覆盖的所有文本，写入系统剪贴板
- **轻量提示**：成功显示 `✅ 已复制`；空选/失败也有对应提示
- **保留列结构**：同一行内跨度较大的列之间自动补 `\t`
- **主题适配**：选框与提示使用 DSH 主题 token，自动适配明暗主题
- **可取消**：拖拽中按 `Esc` 或窗口失焦即取消

## 安装

要求：DSH Web 客户端支持客户端 bundle 插件（`dsh.client`）。

### 方式一：直接从 GitHub 安装（推荐）

在 DSH 的插件管理页选择安装外部 bundle，把安装目标填为：

```text
github:Mi-Chuan/column-select-copy
```

也可以直接对 Agent 说：

```text
请用 plugin_manager 的 install_bundle 安装 github:Mi-Chuan/column-select-copy
```

安装完成后刷新 DSH 页面。

> 这种方式由 pnpm 通过 Git 读取仓库。如果本机 Git 访问 GitHub 失败（例如 Windows 上出现 `CRYPT_E_NO_REVOCATION_CHECK`），请改用方式二。

### 方式二：下载 Release 压缩包

从 [Releases](https://github.com/Mi-Chuan/column-select-copy/releases/latest) 下载 `column-select-copy-1.0.0.tgz`，然后把安装目标填为压缩包的绝对路径，或直接填下载地址：

```text
https://github.com/Mi-Chuan/column-select-copy/releases/download/v1.0.0/column-select-copy-1.0.0.tgz
```

### 方式三：克隆到本地安装（开发用）

```bash
git clone https://github.com/Mi-Chuan/column-select-copy.git
```

在 DSH 中把安装目标指向克隆后的 `column-select-copy` 目录（包含 `package.json` 的那一层），安装后启用插件并刷新页面。

> 本仓库尚未发布到 npm；安装目标是仓库目录或上面的 Release 压缩包，不是 GitHub 网页地址。

## 使用

1. 在对话正文中按住 `Alt`
2. 用鼠标左键拖拽出矩形选框
3. 松开左键

成功后底部出现 `✅ 已复制`，此时可直接 `Ctrl+V` 粘贴。

## 实现说明

- 插件只包含客户端代码，注册到 `shell.overlay` 浮层，不修改对话 DOM。
- 在 window 捕获阶段监听 `pointerdown/move/up`，仅当 `altKey + 左键 + 对话滚动区` 时启动。
- 通过 `Range.getBoundingClientRect()` 逐字符判断与选框是否相交，再按 `top` 分行、`left` 排序，行间用 `\n` 连接。
- 剪贴板优先使用 `navigator.clipboard.writeText`，失败时回退到隐藏 `textarea` + `execCommand('copy')`。

主要文件：

```text
client.js         客户端逻辑（选框、提取、剪贴板、提示）
index.js          Host 半区（空实现）
cordis.patch.yml  bundle 注册 patch
locale/           插件名称与描述的中英文案
package.json      bundle 清单
```

## 限制

- 只在对话正文区域生效；输入框、侧边栏不会触发。
- 伪元素（如部分列表符号）和 Shadow DOM 内的文本不会被提取。
- 若浏览器/Electron 拒绝剪贴板权限，会尝试回退方案；仍失败时提示“复制失败”。

## License

MIT
