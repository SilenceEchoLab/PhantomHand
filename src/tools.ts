import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { EXTENSION_PATH } from "./config.js";

  export function setupTools(mcpServer: Server, sendWsCommand: (action: string, data?: any, expected?: string) => Promise<any>) {
    mcpServer.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools: [
          // ── New Tool for Extension Setup ──
          {
            name: "get_extension_info",
            description: "Get the absolute local path to the unpacked browser extension folder. Use this to help the user load the extension if it is not connected.",
            inputSchema: { type: "object", properties: {} }
          },
          // ── Existing Tools ──
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
        },
        {
          name: "browser_upload_file",
          description: "Upload a local file to a file input element by CSS selector.",
          inputSchema: { type: "object", properties: { selector: { type: "string" }, filePath: { type: "string" } }, required: ["selector", "filePath"] }
        },
        {
          name: "browser_extract_text",
          description: "Get the raw text content of the active page or a specific CSS selector.",
          inputSchema: { type: "object", properties: { selector: { type: "string" } } }
        },
        {
          name: "browser_get_attributes",
          description: "Get all attributes of an element by CSS selector.",
          inputSchema: { type: "object", properties: { selector: { type: "string" } }, required: ["selector"] }
        },
        {
          name: "browser_scroll_to_element",
          description: "Scroll the page so the specified element is centered in the viewport.",
          inputSchema: { type: "object", properties: { selector: { type: "string" } }, required: ["selector"] }
        },

        // ── Mouse Tools ──
        {
          name: "browser_double_click",
          description: "Double-click at physical coordinates. Useful for selecting a word in text.",
          inputSchema: {
            type: "object",
            properties: { x: { type: "number" }, y: { type: "number" } },
            required: ["x", "y"]
          }
        },
        {
          name: "browser_triple_click",
          description: "Triple-click at physical coordinates to select all text in the target element (e.g., select entire text in an input field).",
          inputSchema: {
            type: "object",
            properties: { x: { type: "number" }, y: { type: "number" } },
            required: ["x", "y"]
          }
        },
        {
          name: "browser_right_click",
          description: "Right-click (context menu) at physical coordinates.",
          inputSchema: {
            type: "object",
            properties: { x: { type: "number" }, y: { type: "number" } },
            required: ["x", "y"]
          }
        },
        {
          name: "browser_drag",
          description: "Drag from one coordinate to another with smooth intermediate steps. Useful for drag-and-drop, slider manipulation, or text selection by dragging.",
          inputSchema: {
            type: "object",
            properties: {
              fromX: { type: "number" },
              fromY: { type: "number" },
              toX: { type: "number" },
              toY: { type: "number" },
              steps: { type: "number", description: "Number of intermediate mouse-move steps (default: 10)" }
            },
            required: ["fromX", "fromY", "toX", "toY"]
          }
        },

        // ── Keyboard Tools ──
        {
          name: "browser_select_all",
          description: "Select all text/content in the currently focused element (Ctrl+A). Commonly used before typing to replace existing text in input fields.",
          inputSchema: { type: "object", properties: {} }
        },
        {
          name: "browser_keyboard_shortcut",
          description: "Send a keyboard shortcut with modifier keys. Examples: Ctrl+C for copy, Ctrl+V for paste, Ctrl+A for select all, Ctrl+Z for undo, Ctrl+Shift+I for DevTools.",
          inputSchema: {
            type: "object",
            properties: {
              key: { type: "string" },
              ctrl: { type: "boolean" },
              alt: { type: "boolean" },
              shift: { type: "boolean" },
              meta: { type: "boolean" }
            },
            required: ["key"]
          }
        },

        // ── Form Tools ──
        {
          name: "browser_set_value",
          description: "Directly set the value of an input or textarea element by CSS selector, bypassing the need to click and type. Triggers input and change events. Use this for fast, reliable form filling.",
          inputSchema: {
            type: "object",
            properties: { selector: { type: "string" }, value: { type: "string" } },
            required: ["selector", "value"]
          }
        },
        {
          name: "browser_clear_value",
          description: "Clear the value of an input or textarea element by CSS selector and trigger change events.",
          inputSchema: {
            type: "object",
            properties: { selector: { type: "string" } },
            required: ["selector"]
          }
        },
        {
          name: "browser_select_option",
          description: "Select an option in a <select> dropdown by value attribute or visible text.",
          inputSchema: {
            type: "object",
            properties: { selector: { type: "string" }, value: { type: "string" } },
            required: ["selector", "value"]
          }
        },
        {
          name: "browser_check",
          description: "Check or uncheck a checkbox or radio button by CSS selector.",
          inputSchema: {
            type: "object",
            properties: { selector: { type: "string" }, checked: { type: "boolean" } },
            required: ["selector", "checked"]
          }
        },
        {
          name: "browser_focus",
          description: "Focus on an element identified by CSS selector.",
          inputSchema: {
            type: "object",
            properties: { selector: { type: "string" } },
            required: ["selector"]
          }
        },

        // ── Screenshot & Timing ──
        {
          name: "browser_screenshot",
          description: "Take a screenshot of the current visible page and return it as an image.",
          inputSchema: { type: "object", properties: {} }
        },
        {
          name: "browser_wait",
          description: "Wait/pause for a specified number of milliseconds before the next action. Useful for waiting for animations, AJAX requests, or page transitions. Default: 1000ms, Max: 30000ms.",
          inputSchema: {
            type: "object",
            properties: { ms: { type: "number" } }
          }
        },

        // ── Tab Management ──
        {
          name: "browser_tab_new",
          description: "Open a new browser tab, optionally navigating to a URL.",
          inputSchema: {
            type: "object",
            properties: { url: { type: "string" } }
          }
        },
        {
          name: "browser_tab_close",
          description: "Close the current active browser tab.",
          inputSchema: { type: "object", properties: {} }
        },
        {
          name: "browser_tab_list",
          description: "List all open browser tabs with their IDs, titles, and URLs.",
          inputSchema: { type: "object", properties: {} }
        },
        {
          name: "browser_tab_switch",
          description: "Switch to a specific browser tab by its tab ID (obtained from browser_tab_list).",
          inputSchema: {
            type: "object",
            properties: { tabId: { type: "number" } },
            required: ["tabId"]
          }
        },

        // ── Navigation ──
        {
          name: "browser_go_back",
          description: "Navigate back in the browser history.",
          inputSchema: { type: "object", properties: {} }
        },
        {
          name: "browser_go_forward",
          description: "Navigate forward in the browser history.",
          inputSchema: { type: "object", properties: {} }
        },
        {
          name: "browser_reload",
          description: "Reload the current page.",
          inputSchema: { type: "object", properties: {} }
        },
        {
          name: "browser_get_page_info",
          description: "Get the current page URL and title.",
          inputSchema: { type: "object", properties: {} }
        }
      ]
    }));

    mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        switch (request.params.name) {
          case "get_extension_info": {
            return {
              content: [{
                type: "text",
                text: `The PhantomHand extension is located at: ${EXTENSION_PATH}\n\nPlease load this unpacked extension in Chrome/Edge via chrome://extensions/.`
              }]
            };
          }
          // ── Existing Handlers ──
          case "browser_navigate": {
            const url = String(request.params.arguments?.url);
            await sendWsCommand("navigate", { url }, "navigate_done");
            return { content: [{ type: "text", text: `Navigated to ${url}` }] };
          }
          case "browser_scan": {
            const scanData = await sendWsCommand("scan", {}, "scan_result");
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
            await sendWsCommand("click", { x, y }, "click_done");
            return { content: [{ type: "text", text: `Physical click executed at (${x}, ${y}). Make sure to invoke browser_scan to observe the updated page state.` }] };
          }
          case "browser_type": {
            const text = String(request.params.arguments?.text);
            await sendWsCommand("type", { text }, "type_done");
            return { content: [{ type: "text", text: `Typed: "${text}". Make sure to invoke browser_scan to observe the updated page state.` }] };
          }
          case "browser_scroll": {
            const deltaY = Number(request.params.arguments?.deltaY);
            await sendWsCommand("scroll", { deltaY }, "scroll_done");
            return { content: [{ type: "text", text: `Scrolled by ${deltaY}px` }] };
          }
          case "browser_press_key": {
            const key = String(request.params.arguments?.key);
            await sendWsCommand("press_key", { key }, "press_key_done");
            return { content: [{ type: "text", text: `Pressed key: ${key}` }] };
          }
          case "browser_hover": {
            const x = Number(request.params.arguments?.x);
            const y = Number(request.params.arguments?.y);
            await sendWsCommand("hover", { x, y }, "hover_done");
            return { content: [{ type: "text", text: `Hovered at (${x}, ${y})` }] };
          }
          case "browser_eval_js": {
            const code = String(request.params.arguments?.code);
            const res = await sendWsCommand("eval_js", { code }, "eval_js_done");
            return { content: [{ type: "text", text: `JS Evaluated. Result: ${JSON.stringify(res.result)}` }] };
          }
          case "browser_get_html": {
            const selector = request.params.arguments?.selector ? String(request.params.arguments?.selector) : undefined;
            const res = await sendWsCommand("get_html", { selector }, "get_html_done");
            return { content: [{ type: "text", text: `HTML Extracted:\n${res.html}` }] };
          }
          case "browser_upload_file": {
            const selector = String(request.params.arguments?.selector);
            const filePath = String(request.params.arguments?.filePath);
            const res = await sendWsCommand("upload_file", { selector, filePath }, "upload_file_done");
            return { content: [{ type: "text", text: res.success ? `File uploaded.` : `Failed: ${res.error}` }] };
          }
          case "browser_extract_text": {
            const selector = request.params.arguments?.selector ? String(request.params.arguments?.selector) : undefined;
            const res = await sendWsCommand("extract_text", { selector }, "extract_text_done");
            return { content: [{ type: "text", text: `Extracted text:\n${res.text}` }] };
          }
          case "browser_get_attributes": {
            const selector = String(request.params.arguments?.selector);
            const res = await sendWsCommand("get_attributes", { selector }, "get_attributes_done");
            return { content: [{ type: "text", text: `Attributes for ${selector}:\n${JSON.stringify(res.attributes, null, 2)}` }] };
          }
          case "browser_scroll_to_element": {
            const selector = String(request.params.arguments?.selector);
            const res = await sendWsCommand("scroll_to_element", { selector }, "scroll_to_element_done");
            return { content: [{ type: "text", text: res.success ? `Scrolled to element ${selector}.` : `Element not found.` }] };
          }

          // ── Mouse Tools ──
          case "browser_double_click": {
            const x = Number(request.params.arguments?.x);
            const y = Number(request.params.arguments?.y);
            await sendWsCommand("double_click", { x, y }, "double_click_done");
            return { content: [{ type: "text", text: `Double-clicked at (${x}, ${y}). Use browser_scan to observe the updated page state.` }] };
          }
          case "browser_triple_click": {
            const x = Number(request.params.arguments?.x);
            const y = Number(request.params.arguments?.y);
            await sendWsCommand("triple_click", { x, y }, "triple_click_done");
            return { content: [{ type: "text", text: `Triple-clicked at (${x}, ${y}) to select all text. Use browser_scan to observe.` }] };
          }
          case "browser_right_click": {
            const x = Number(request.params.arguments?.x);
            const y = Number(request.params.arguments?.y);
            await sendWsCommand("right_click", { x, y }, "right_click_done");
            return { content: [{ type: "text", text: `Right-clicked at (${x}, ${y}).` }] };
          }
          case "browser_drag": {
            const fromX = Number(request.params.arguments?.fromX);
            const fromY = Number(request.params.arguments?.fromY);
            const toX = Number(request.params.arguments?.toX);
            const toY = Number(request.params.arguments?.toY);
            const steps = Number(request.params.arguments?.steps) || 10;
            await sendWsCommand("drag", { fromX, fromY, toX, toY, steps }, "drag_done");
            return { content: [{ type: "text", text: `Dragged from (${fromX}, ${fromY}) to (${toX}, ${toY}).` }] };
          }

          // ── Keyboard Tools ──
          case "browser_select_all": {
            await sendWsCommand("select_all", {}, "select_all_done");
            return { content: [{ type: "text", text: `Selected all text in focused element.` }] };
          }
          case "browser_keyboard_shortcut": {
            const key = String(request.params.arguments?.key);
            const ctrl = !!request.params.arguments?.ctrl;
            const alt = !!request.params.arguments?.alt;
            const shift = !!request.params.arguments?.shift;
            const meta = !!request.params.arguments?.meta;
            await sendWsCommand("keyboard_shortcut", { key, ctrl, alt, shift, meta }, "keyboard_shortcut_done");
            return { content: [{ type: "text", text: `Keyboard shortcut sent: ${[ctrl && 'Ctrl', alt && 'Alt', shift && 'Shift', meta && 'Meta', key].filter(Boolean).join('+')}` }] };
          }

          // ── Form Tools ──
          case "browser_set_value": {
            const selector = String(request.params.arguments?.selector);
            const value = String(request.params.arguments?.value);
            const res = await sendWsCommand("set_value", { selector, value }, "set_value_done");
            if (res.success) {
              return { content: [{ type: "text", text: `Value set for '${selector}' to '${value}'.` }] };
            } else {
              return { content: [{ type: "text", text: `Error setting value for '${selector}': ${res.error || 'Unknown error'}` }], isError: true };
            }
          }
          case "browser_clear_value": {
            const selector = String(request.params.arguments?.selector);
            await sendWsCommand("clear_value", { selector }, "clear_value_done");
            return { content: [{ type: "text", text: `Value cleared for '${selector}'.` }] };
          }
          case "browser_select_option": {
            const selector = String(request.params.arguments?.selector);
            const value = String(request.params.arguments?.value);
            await sendWsCommand("select_option", { selector, value }, "select_option_done");
            return { content: [{ type: "text", text: `Option '${value}' selected in '${selector}'.` }] };
          }
          case "browser_check": {
            const selector = String(request.params.arguments?.selector);
            const checked = !!request.params.arguments?.checked;
            await sendWsCommand("check", { selector, checked }, "check_done");
            return { content: [{ type: "text", text: `${checked ? 'Checked' : 'Unchecked'} element '${selector}'.` }] };
          }
          case "browser_focus": {
            const selector = String(request.params.arguments?.selector);
            await sendWsCommand("focus", { selector }, "focus_done");
            return { content: [{ type: "text", text: `Focused on element '${selector}'.` }] };
          }

          // ── Screenshot & Timing ──
          case "browser_screenshot": {
            const screenshotData = await sendWsCommand("screenshot", {}, "screenshot_result");
            return {
              content: [
                { type: "text", text: "Screenshot captured." },
                { type: "image", data: screenshotData.screenshot.split(',')[1], mimeType: "image/jpeg" }
              ]
            };
          }
          case "browser_wait": {
            const ms = Math.min(Math.max(Number(request.params.arguments?.ms) || 1000, 100), 30000);
            await new Promise(r => setTimeout(r, ms));
            return { content: [{ type: "text", text: `Waited ${ms}ms.` }] };
          }

          // ── Tab Management ──
          case "browser_tab_new": {
            const url = request.params.arguments?.url ? String(request.params.arguments?.url) : "";
            await sendWsCommand("tab_new", { url }, "tab_new_done");
            return { content: [{ type: "text", text: `New tab opened.${url ? ' Navigated to ' + url : ''}` }] };
          }
          case "browser_tab_close": {
            await sendWsCommand("tab_close", {}, "tab_close_done");
            return { content: [{ type: "text", text: `Active tab closed.` }] };
          }
          case "browser_tab_list": {
            const res = await sendWsCommand("tab_list", {}, "tab_list_result");
            const tabs = res.tabs || [];
            const formatted = tabs.map((t: any) => `[${t.active ? '*' : ' '}] ID: ${t.id} | Title: "${t.title}" | URL: ${t.url}`).join("\n");
            return { content: [{ type: "text", text: `Open tabs:\n${formatted}` }] };
          }
          case "browser_tab_switch": {
            const tabId = Number(request.params.arguments?.tabId);
            await sendWsCommand("tab_switch", { tabId }, "tab_switch_done");
            return { content: [{ type: "text", text: `Switched to tab ${tabId}.` }] };
          }

          // ── Navigation ──
          case "browser_go_back": {
            await sendWsCommand("go_back", {}, "go_back_done");
            return { content: [{ type: "text", text: `Navigated back.` }] };
          }
          case "browser_go_forward": {
            await sendWsCommand("go_forward", {}, "go_forward_done");
            return { content: [{ type: "text", text: `Navigated forward.` }] };
          }
          case "browser_reload": {
            await sendWsCommand("reload", {}, "reload_done");
            return { content: [{ type: "text", text: `Page reloaded.` }] };
          }
          case "browser_get_page_info": {
            const res = await sendWsCommand("get_page_info", {}, "get_page_info_result");
            return { content: [{ type: "text", text: `Page Info:\nURL: ${res.url}\nTitle: ${res.title}` }] };
          }

          default:
            throw new Error(`Unknown tool: ${request.params.name}`);
        }
      } catch (error: any) {
        return { content: [{ type: "text", text: `Error executing tool: ${error.message}` }], isError: true };
      }
    });
  }

