# PhantomHand

本工程是一个极简且轻量的浏览器控制引擎，专为基于大语言模型（LLM）的智能体（Agent）设计。它可以将浏览器的操作权限（通过 Chrome DevTools Protocol，简称 CDP）以 Model Context Protocol (MCP) 标准安全地暴露给智能体，让 AI 能够像人类一样视觉感知并真实点击浏览器网页。

---

## 🛠️ 环境准备与安装

**前提条件：** 请确保您的电脑已安装 Node.js。

1. **安装依赖**：
   在工程根目录下执行以下命令，安装基础服务依赖：
   ```bash
   npm install
   ```

2. **全局注册与构建**：
   你可以通过 `npm run build` 打包。本项目目前已为您自动注册到了 Antigravity 的全局 `mcp_config.json` 中。
   *由于我们采用了极致的单体架构合并，**您甚至不再需要单独开一个终端运行服务！***

---

## 🔌 安装与配置浏览器拓展

1. **加载拓展程序**：
   - 打开您的 Chrome 或 Edge 浏览器，访问拓展管理页面（Chrome: `chrome://extensions/`）。
   - 在右上角开启 **“开发者模式 (Developer mode)”**。
   - 点击 **“加载已解压的扩展程序 (Load unpacked)”** 按钮。
   - 选中本工程根目录下的 `extension` 文件夹。

2. **连接到指令中心**：
   - 只要任何一个支持 MCP 的 AI Agent（比如 Antigravity CLI、Cursor、Claude Desktop）启动了本服务，本地的 `ws://localhost:37210` 调度中心就会**自动随之启动**。
   - 点击浏览器右上角的拓展图标打开弹窗，在 URL 框中保留默认的 **`ws://localhost:37210`**。
   - 点击 **"Connect to Agent Server"** 按钮，指示灯变为**绿色**即连接成功。

---

## 🚀 运行与使用

### 在 Antigravity CLI 中全自动操作（零配置体验）
得益于全新打磨的统一架构，MCP Server 和 WebSocket Command Center 现已完美融为一体！
1. 启动任意一个 Antigravity CLI 会话（运行 `agy`）。
2. 在浏览器中点开插件点击一下 `Connect` 绿灯连上。
3. 直接用自然语言对大模型下发命令，例如：
> _"帮我在浏览器里打开百度的页面，用 JS 获取当天的热搜榜，然后点击搜索框输入内容。"_

### 在其他所有 AI Agent 中使用（Cursor / Claude Desktop）
你只需要将本服务的启动命令加入对应软件的 `mcp.json` 或 `claude_desktop_config.json` 中即可：
```json
{
  "mcpServers": {
    "phantom-hand": {
      "command": "npx",
      "args": ["tsx", "你的绝对路径/index.ts"]
    }
  }
}
```

---

## ⚠️ 重要避坑指南 (Troubleshooting)

1. **“为什么我发送了指令，浏览器却没有反应？”**
   出于安全机制，Chrome 浏览器**严禁**任何拓展程序在系统保护页（例如空白新标签页 `chrome://newtab`、设置页 `chrome://settings`、拓展管理页 `chrome://extensions`）上执行调试 API。
   👉 **解决方法**：请始终保证浏览器当前聚焦（Active）的是一个**常规的普通网页**（例如 `https://github.com`），拓展才能顺利注入并执行您的指令！
2. **“端口冲突怎么解决？”**
   如果 `37210` 端口被占用，您只需修改 `index.ts` 里的端口号，然后在拓展弹窗中填入对应的新端口进行重连即可。
