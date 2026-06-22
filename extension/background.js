let ws = null;
let currentTabId = null;

function connectWebSocket() {
  chrome.storage.local.get(['wsUrl'], (res) => {
    const url = res.wsUrl;
    if (!url) return;

    if (ws) {
      ws.close();
    }

    ws = new WebSocket(url);

    ws.onopen = () => {
      chrome.storage.local.set({ connectionStatus: 'connected' });
      ws.send(JSON.stringify({ type: 'register_extension' }));
    };

    ws.onmessage = async (event) => {
      const msg = JSON.parse(event.data);
      if (msg.target === 'extension') {
        await executeCommand(msg);
      }
    };

    ws.onclose = () => {
      chrome.storage.local.set({ connectionStatus: 'disconnected' });
      // Reconnect with backoff
      setTimeout(connectWebSocket, 5000);
    };
    
    ws.onerror = () => {
      ws.close();
    };
  });
}

// Initial connect
connectWebSocket();

// Listen for popup telling us to reconnect
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'reconnect') {
    connectWebSocket();
  }
});


// Core Execution Engine
async function executeCommand(command) {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs.length === 0) return;
  const tabId = tabs[0].id;
  currentTabId = tabId;

  // Ensure we can attach debugger (stealth CDP execution)
  try {
    await chrome.debugger.attach({ tabId }, "1.3");
  } catch (e) {
    // Already attached or forbidden URL
  }

  try {
    if (command.action === 'navigate') {
      await chrome.tabs.update(tabId, { url: command.url });
      replyToAgent("navigate_done", { url: command.url });
    } 
    else if (command.action === 'scan') {
      // Inject perception script
      chrome.scripting.executeScript({
        target: { tabId },
        files: ["content.js"]
      }, () => {
        // Ping content script to extract DOM & draw Set-of-Marks
        chrome.tabs.sendMessage(tabId, { type: "PERCEIVE_DOM" }, (marks) => {
          // Add small delay to ensure DOM redraws visual marks before capture
          setTimeout(() => {
            chrome.tabs.captureVisibleTab(null, { format: "jpeg", quality: 60 }, (screenshotUrl) => {
              // Immediately clear marks after taking screenshot for stealth
              chrome.tabs.sendMessage(tabId, { type: "CLEAR_MARKS" });
              replyToAgent("scan_result", { marks, screenshot: screenshotUrl });
            });
          }, 100);
        });
      });
    }
    else if (command.action === 'click') {
      const { x, y } = command;
      // Stealth physical simulation: mouse moved, pressed, released
      // Emulating Fitts's Law approximation with multiple waypoints could be added here
      await chrome.debugger.sendCommand({ tabId }, "Input.dispatchMouseEvent", {
        type: "mouseMoved", x, y
      });
      await chrome.debugger.sendCommand({ tabId }, "Input.dispatchMouseEvent", {
        type: "mousePressed", x, y, button: "left", clickCount: 1
      });
      await setTimeout(() => {}, 50); // slight human press delay
      await chrome.debugger.sendCommand({ tabId }, "Input.dispatchMouseEvent", {
        type: "mouseReleased", x, y, button: "left", clickCount: 1
      });
      replyToAgent("click_done", { x, y });
    }
    else if (command.action === 'type') {
      for (const char of command.text) {
        await chrome.debugger.sendCommand({ tabId }, "Input.dispatchKeyEvent", {
          type: "char", text: char
        });
        // Human-like typing rhythm (70-120ms gap)
        await new Promise(r => setTimeout(r, 70 + Math.random() * 50));
      }
      replyToAgent("type_done", { text: command.text });
    }
    else if (command.action === 'scroll') {
      await chrome.debugger.sendCommand({ tabId }, "Input.dispatchMouseEvent", {
        type: "mouseWheel", x: command.x || 500, y: command.y || 500, deltaX: 0, deltaY: command.deltaY
      });
      replyToAgent("scroll_done", { deltaY: command.deltaY });
    }
    else if (command.action === 'press_key') {
      // For special keys like Enter, Tab, Escape
      await chrome.debugger.sendCommand({ tabId }, "Input.dispatchKeyEvent", {
        type: "rawKeyDown", key: command.key
      });
      await chrome.debugger.sendCommand({ tabId }, "Input.dispatchKeyEvent", {
        type: "keyUp", key: command.key
      });
      replyToAgent("press_key_done", { key: command.key });
    }
    else if (command.action === 'hover') {
      await chrome.debugger.sendCommand({ tabId }, "Input.dispatchMouseEvent", {
        type: "mouseMoved", x: command.x, y: command.y
      });
      replyToAgent("hover_done", { x: command.x, y: command.y });
    }
    else if (command.action === 'eval_js') {
      const res = await chrome.scripting.executeScript({
        target: { tabId },
        func: (code) => {
          try { return eval(code); } catch (e) { return e.toString(); }
        },
        args: [command.code]
      });
      replyToAgent("eval_js_done", { result: res[0]?.result });
    }
    else if (command.action === 'get_html') {
      const res = await chrome.scripting.executeScript({
        target: { tabId },
        func: (selector) => {
          if (selector) {
            const el = document.querySelector(selector);
            return el ? el.outerHTML : "Element not found";
          }
          return document.documentElement.outerHTML;
        },
        args: [command.selector]
      });
      replyToAgent("get_html_done", { html: res[0]?.result });
    }
  } catch (error) {
    replyToAgent("error", { message: error.message });
  }
}

function replyToAgent(action, data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ target: "dashboard", action, data }));
  }
}
