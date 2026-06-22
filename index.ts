#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { WebSocket, WebSocketServer } from "ws";
import { createServer } from "http";

const PORT = 37210;

class BrowserMcpServer {
  private mcpServer: Server;
  private wss!: WebSocketServer;
  private browserSockets: Set<WebSocket> = new Set();
  private pendingRequests: Map<string, { resolve: (val: any) => void, reject: (err: any) => void }> = new Map();

  constructor() {
    this.mcpServer = new Server(
      { name: "phantom-hand", version: "1.0.0" },
      { capabilities: { tools: {} } }
    );
    this.setupTools();
  }

  private startWebSocketServer() {
    const server = createServer();
    this.wss = new WebSocketServer({ server });

    this.wss.on("connection", (ws) => {
      ws.on("message", (message) => {
        try {
          const data = JSON.parse(message.toString());
          if (data.type === 'register_extension') {
            this.browserSockets.add(ws);
            console.error("[MCP] Browser Extension Connected");
          } 
          else if (data.target === 'dashboard' && data.action) {
            if (this.pendingRequests.has(data.action)) {
              const { resolve } = this.pendingRequests.get(data.action)!;
              this.pendingRequests.delete(data.action);
              resolve(data.data);
            }
          }
        } catch (e) {
          console.error("[MCP] WS Parse Error", e);
        }
      });

      ws.on("close", () => {
        this.browserSockets.delete(ws);
        console.error("[MCP] Browser Extension Disconnected");
      });
    });

    server.listen(PORT, () => {
      console.error(`[MCP] WebSocket Command Center running on ws://localhost:${PORT}`);
    });
  }

  private async sendWsCommand(action: string, data: any = {}, expectedResponseAction: string): Promise<any> {
    if (this.browserSockets.size === 0) {
      throw new Error("No browser extension connected. Please open the browser, click the extension icon, and connect to ws://localhost:37210");
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(expectedResponseAction);
        reject(new Error(`Timeout waiting for browser to complete action: ${action}`));
      }, 15000);

      this.pendingRequests.set(expectedResponseAction, {
        resolve: (val) => { clearTimeout(timeout); resolve(val); },
        reject: (err) => { clearTimeout(timeout); reject(err); }
      });

      const payload = JSON.stringify({ target: 'extension', action, ...data });
      this.browserSockets.forEach(s => s.send(payload));
    });
  }

  private setupTools() {
    this.mcpServer.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "browser_navigate",
          description: "Navigate the active browser tab to a specific URL.",
          inputSchema: { type: "object", properties: { url: { type: "string" } }, required: ["url"] }
        },
        {
          name: "browser_scan",
          description: "Scan the current page viewport, returning a list of interactable elements and their physical coordinates.",
          inputSchema: { type: "object", properties: {} }
        },
        {
          name: "browser_click",
          description: "Move the mouse to physical coordinates via Bezier curve and simulate a left-click.",
          inputSchema: {
            type: "object",
            properties: { x: { type: "number" }, y: { type: "number" } },
            required: ["x", "y"]
          }
        },
        {
          name: "browser_type",
          description: "Inject physical keystrokes into the active element (Requires clicking the element first).",
          inputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] }
        },
        {
          name: "browser_scroll",
          description: "Scroll the page using physical mouse wheel events.",
          inputSchema: { type: "object", properties: { deltaY: { type: "number" } }, required: ["deltaY"] }
        },
        {
          name: "browser_press_key",
          description: "Press a special key (e.g., Enter, Tab, Escape, Backspace).",
          inputSchema: { type: "object", properties: { key: { type: "string" } }, required: ["key"] }
        },
        {
          name: "browser_hover",
          description: "Hover the mouse over a specific physical coordinate.",
          inputSchema: { type: "object", properties: { x: { type: "number" }, y: { type: "number" } }, required: ["x", "y"] }
        },
        {
          name: "browser_eval_js",
          description: "Evaluate arbitrary JavaScript in the context of the active page.",
          inputSchema: { type: "object", properties: { code: { type: "string" } }, required: ["code"] }
        },
        {
          name: "browser_get_html",
          description: "Get the HTML content of the active page or a specific CSS selector.",
          inputSchema: { type: "object", properties: { selector: { type: "string" } } }
        }
      ]
    }));

    this.mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        switch (request.params.name) {
          case "browser_navigate": {
            const url = String(request.params.arguments?.url);
            await this.sendWsCommand("navigate", { url }, "navigate_done");
            return { content: [{ type: "text", text: `Navigated to ${url}` }] };
          }
          case "browser_scan": {
            const scanData = await this.sendWsCommand("scan", {}, "scan_result");
            const marks = scanData.marks || [];
            const formattedNodes = marks.map((m: any) => `[ID: ${m.id}] <${m.tag}> Text: "${m.text || 'N/A'}" Role: ${m.role || 'N/A'} | Coordinates: (${m.x}, ${m.y})`).join("\n");
            const outputText = `Scan Complete. Found ${marks.length} nodes.\n\nINTERACTABLE NODES:\n${formattedNodes}\n\nNote: Visual screenshot acquired.`;
            return { 
              content: [
                { type: "text", text: outputText },
                { type: "image", data: scanData.screenshot.split(',')[1], mimeType: "image/jpeg" }
              ] 
            };
          }
          case "browser_click": {
            const x = Number(request.params.arguments?.x);
            const y = Number(request.params.arguments?.y);
            await this.sendWsCommand("click", { x, y }, "click_done");
            return { content: [{ type: "text", text: `Physical click executed at (${x}, ${y}). Make sure to invoke browser_scan to observe the updated page state.` }] };
          }
          case "browser_type": {
            const text = String(request.params.arguments?.text);
            await this.sendWsCommand("type", { text }, "type_done");
            return { content: [{ type: "text", text: `Typed: "${text}". Make sure to invoke browser_scan to observe the updated page state.` }] };
          }
          case "browser_scroll": {
            const deltaY = Number(request.params.arguments?.deltaY);
            await this.sendWsCommand("scroll", { deltaY }, "scroll_done");
            return { content: [{ type: "text", text: `Scrolled by ${deltaY}px` }] };
          }
          case "browser_press_key": {
            const key = String(request.params.arguments?.key);
            await this.sendWsCommand("press_key", { key }, "press_key_done");
            return { content: [{ type: "text", text: `Pressed key: ${key}` }] };
          }
          case "browser_hover": {
            const x = Number(request.params.arguments?.x);
            const y = Number(request.params.arguments?.y);
            await this.sendWsCommand("hover", { x, y }, "hover_done");
            return { content: [{ type: "text", text: `Hovered at (${x}, ${y})` }] };
          }
          case "browser_eval_js": {
            const code = String(request.params.arguments?.code);
            const res = await this.sendWsCommand("eval_js", { code }, "eval_js_done");
            return { content: [{ type: "text", text: `JS Evaluated. Result: ${JSON.stringify(res.result)}` }] };
          }
          case "browser_get_html": {
            const selector = request.params.arguments?.selector ? String(request.params.arguments?.selector) : undefined;
            const res = await this.sendWsCommand("get_html", { selector }, "get_html_done");
            return { content: [{ type: "text", text: `HTML Extracted:\n${res.html}` }] };
          }
          default:
            throw new Error(`Unknown tool: ${request.params.name}`);
        }
      } catch (error: any) {
        return { content: [{ type: "text", text: `Error executing tool: ${error.message}` }], isError: true };
      }
    });
  }

  async run() {
    this.startWebSocketServer();
    const transport = new StdioServerTransport();
    await this.mcpServer.connect(transport);
    console.error("[MCP] Server running on stdio");
  }
}

const server = new BrowserMcpServer();
server.run().catch(console.error);
