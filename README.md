# PhantomHand (MCP)

本工程是一个极简且轻量的浏览器控制引擎，专为基于大语言模型（LLM）的智能体（Agent）设计。它可以将浏览器的操作权限（通过 Chrome DevTools Protocol，简称 CDP）以 Model Context Protocol (MCP) 标准安全地暴露给智能体，让 AI 能够像人类一样视觉感知并真实点击浏览器网页。

---

## ⚡ 快速使用 (NPM 一键接入)

借助标准化的 MCP 设计，现在接入 PhantomHand 变得前所未有的简单。无论你使用 Claude Desktop、Cursor、Windsurf 还是 Antigravity，只需在配置文件中添加一行 NPX 命令即可开箱即用。

打开你的 AI Agent 的 MCP 配置文件（如 `claude_desktop_config.json` 或 `mcp_config.json`），添加以下内容：

```json
{
  "mcpServers": {
    "phantom-hand": {
      "command": "npx",
      "args": ["-y", "phantom-hand-mcp"]
    }
  }
}
```
*保存配置后重启 AI Agent，服务会自动在后台唤醒并监听 `ws://localhost:37210`。*

---

## 🔌 安装浏览器拓展（必须步骤）

虽然 MCP 服务已自动化，但我们仍需要一个浏览器扩展来执行实际的 DOM 注入与操作。

1. **获取插件目录**：
   - 唤醒你的 AI 助手，对它说：“帮我获取 PhantomHand 扩展程序的本地安装路径”。
   - AI 会调用内置的 `get_extension_info` 工具，精准告诉你本机隐藏在 `~/.npm/_npx/.../extension` 下的扩展绝对路径。
   
2. **加载拓展程序**：
   - 打开您的 Chrome 或 Edge 浏览器，访问拓展管理页面（Chrome: `chrome://extensions/`）。
   - 在右上角开启 **“开发者模式 (Developer mode)”**。
   - 点击 **“加载已解压的扩展程序 (Load unpacked)”** 按钮。
   - 选中 AI 刚才告诉你的那个绝对路径文件夹。

3. **连接到指令中心**：
   - 点击浏览器右上角的 PhantomHand 拓展图标打开弹窗，在 URL 框中保留默认的 **`ws://localhost:37210`**。
   - 点击 **"Connect to Agent Server"** 按钮，指示灯变为**绿色**即连接成功。

🎉 **至此，你可以直接用自然语言对大模型下发命令了！例如：**
> _"帮我在浏览器里打开百度的页面，用 JS 获取当天的热搜榜，然后点击搜索框输入内容。"_

---

## 🛠️ 开发者指南 (本地源码运行)

如果你想二次开发或修改源码，请按照以下步骤进行：

1. **安装依赖**：
   ```bash
   npm install
   ```

2. **编译打包**：
   ```bash
   npm run build
   ```
   *打包产物会生成在 `dist/index.cjs` 中。*

3. **运行测试**：
   ```bash
   npm run dev  # 以 ESM 模式直接运行 tsx
   # 或者
   npm start    # 运行编译好的 CJS 文件
   ```

---

## ⚠️ 重要避坑指南 (Troubleshooting)

1. **“为什么我发送了指令，浏览器却没有反应？”**
   出于安全机制，Chrome 浏览器**严禁**任何拓展程序在系统保护页（例如空白新标签页 `chrome://newtab`、设置页 `chrome://settings`、拓展管理页 `chrome://extensions`）上执行调试 API。
   👉 **解决方法**：请始终保证浏览器当前聚焦（Active）的是一个**常规的普通网页**（例如 `https://github.com`），拓展才能顺利注入并执行您的指令！

2. **“端口冲突怎么解决？”**
   如果 `37210` 端口被占用，服务启动时会尝试自动清理该端口的残留进程；如果依然无法启动，您只需修改系统环境变量 `PORT=xxxx` 并在拓展弹窗中填入对应的新端口即可。
