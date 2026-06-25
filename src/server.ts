import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
import { PORT, EXTENSION_PATH } from "./config.js";
import { setupTools } from "./tools.js";

export class BrowserMcpServer {
  private mcpServer: Server;
  private wss!: WebSocketServer;
  private browserSockets: Set<WebSocket> = new Set();
  private pendingRequests: Map<string, { resolve: (val: any) => void, reject: (err: any) => void }> = new Map();

  constructor() {
    this.mcpServer = new Server(
      { name: "phantom-hand", version: "2.0.0" },
      { capabilities: { tools: {} } }
    );
    setupTools(this.mcpServer, this.sendWsCommand.bind(this));
  }

  /**
   * Try to kill the process occupying the given port.
   * Supports Windows (netstat + taskkill) and Unix (lsof + kill).
   */
  private isMaster = true;
  private proxyWsClient: WebSocket | null = null;

  private setupWebSocketHandlers() {
    this.wss.on("connection", (ws, req) => {
      const isProxy = req.url?.includes('type=proxy');
      if (isProxy) {
        ws.on("message", async (message) => {
          try {
            const msg = JSON.parse(message.toString());
            if (msg.action === 'proxy_request') {
              try {
                const res = await this.sendWsCommand(msg.realAction, msg.realData, msg.expectedResponseAction);
                ws.send(JSON.stringify({ action: msg.expectedResponseAction, data: res }));
              } catch (e: any) {
                ws.send(JSON.stringify({ action: 'error', data: { message: e.message } }));
              }
            }
          } catch (e) {
            console.error("[MCP] Proxy handler error", e);
          }
        });
        return;
      }

      ws.on("message", (message) => {
        try {
          const data = JSON.parse(message.toString());
          if (data.type === 'register_extension') {
            this.browserSockets.add(ws);
            console.error("[MCP] Browser Extension Connected");
          } 
          else if (data.target === 'dashboard' && data.action) {
            if (data.action === 'error') {
              for (const [key, { reject }] of this.pendingRequests.entries()) {
                reject(new Error(data.data?.message || 'Unknown browser error'));
              }
              this.pendingRequests.clear();
            } else if (this.pendingRequests.has(data.action)) {
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
  }

  private startProxyClient() {
    this.proxyWsClient = new WebSocket("ws://localhost:" + PORT + "/?type=proxy");
    this.proxyWsClient.on('open', () => {
      console.error("[MCP] Connected to Master MCP on port " + PORT + " as a Proxy");
    });
    this.proxyWsClient.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.action === 'error') {
          for (const [key, { reject }] of this.pendingRequests.entries()) {
            reject(new Error(msg.data?.message || 'Unknown browser error'));
          }
          this.pendingRequests.clear();
        } else if (this.pendingRequests.has(msg.action)) {
          const { resolve } = this.pendingRequests.get(msg.action)!;
          this.pendingRequests.delete(msg.action);
          resolve(msg.data);
        }
      } catch (e) {
        console.error("[MCP] Proxy Parse Error", e);
      }
    });
    this.proxyWsClient.on('close', () => {
      console.error("[MCP] Disconnected from Master. Retrying in 2s...");
      setTimeout(() => this.startProxyClient(), 2000);
    });
  }

  private startWebSocketServer(): Promise<void> {
    return new Promise((resolve) => {
      const server = createServer();

      server.once("error", (err: any) => {
        if (err.code === "EADDRINUSE") {
          console.error(`[MCP] Port ` + PORT + ` is in use. Falling back to Proxy Broker mode...`);
          this.isMaster = false;
          this.startProxyClient();
          resolve();
        }
      });

      server.listen(PORT, () => {
        this.isMaster = true;
        this.wss = new WebSocketServer({ server });
        this.setupWebSocketHandlers();
        console.error(`[MCP] WebSocket Master running on ws://localhost:` + PORT);
        resolve();
      });
    });
  }

  private async sendWsCommand(action: string, data: any = {}, expectedResponseAction: string): Promise<any> {
    if (this.isMaster && this.browserSockets.size === 0) {
      throw new Error(`No browser extension connected. If you haven't installed it, the unpacked extension is located at: ` + EXTENSION_PATH + `. Please load it in Chrome/Edge via chrome://extensions, then click its icon to connect to ws://localhost:` + PORT);
    }
    if (!this.isMaster && (!this.proxyWsClient || this.proxyWsClient.readyState !== WebSocket.OPEN)) {
      throw new Error(`Proxy client not connected to Master on ws://localhost:` + PORT);
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(expectedResponseAction);
        reject(new Error(`Timeout waiting for browser to complete action: ` + action));
      }, 30000);

      this.pendingRequests.set(expectedResponseAction, {
        resolve: (val) => { clearTimeout(timeout); resolve(val); },
        reject: (err) => { clearTimeout(timeout); reject(err); }
      });

      if (this.isMaster) {
        const payload = JSON.stringify({ target: 'extension', action, ...data });
        this.browserSockets.forEach(s => s.send(payload));
      } else {
        const payload = JSON.stringify({ action: 'proxy_request', realAction: action, realData: data, expectedResponseAction });
        this.proxyWsClient!.send(payload);
      }
    });
  }

  async run() {
    await this.startWebSocketServer();
    const transport = new StdioServerTransport();
    await this.mcpServer.connect(transport);
    console.error("[MCP] Server running on stdio");
  }
}