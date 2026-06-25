let ws = null;
let currentTabId = null;

function connectWebSocket() {
  chrome.storage.local.get(['wsUrl'], (res) => {
    let url = res.wsUrl;
    if (!url) {
      url = 'ws://localhost:37210';
      chrome.storage.local.set({ wsUrl: url });
    }

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


// Helper: map key name to Windows virtual key code
function getVirtualKeyCode(key) {
  const map = {
    'Backspace': 8, 'Tab': 9, 'Enter': 13, 'Shift': 16, 'Control': 17, 'Alt': 18,
    'Escape': 27, 'Space': 32, ' ': 32, 'ArrowLeft': 37, 'ArrowUp': 38, 'ArrowRight': 39, 'ArrowDown': 40,
    'Delete': 46, 'Home': 36, 'End': 35, 'PageUp': 33, 'PageDown': 34,
    'F1': 112, 'F2': 113, 'F3': 114, 'F4': 115, 'F5': 116, 'F6': 117,
    'F7': 118, 'F8': 119, 'F9': 120, 'F10': 121, 'F11': 122, 'F12': 123,
    '0': 48, '1': 49, '2': 50, '3': 51, '4': 52, '5': 53, '6': 54, '7': 55, '8': 56, '9': 57
  };
  if (map[key]) return map[key];
  if (key.length === 1) return key.toUpperCase().charCodeAt(0);
  return 0;
}

// Helper: map key name to CDP code string
function getKeyCode(key) {
  const map = {
    'Backspace': 'Backspace', 'Tab': 'Tab', 'Enter': 'Enter', 'Shift': 'ShiftLeft',
    'Control': 'ControlLeft', 'Alt': 'AltLeft', 'Escape': 'Escape', 'Space': 'Space', ' ': 'Space',
    'ArrowLeft': 'ArrowLeft', 'ArrowUp': 'ArrowUp', 'ArrowRight': 'ArrowRight', 'ArrowDown': 'ArrowDown',
    'Delete': 'Delete', 'Home': 'Home', 'End': 'End', 'PageUp': 'PageUp', 'PageDown': 'PageDown'
  };
  if (map[key]) return map[key];
  if (key.length === 1) {
    const upper = key.toUpperCase();
    if (upper >= 'A' && upper <= 'Z') return 'Key' + upper;
    if (upper >= '0' && upper <= '9') return 'Digit' + upper;
  }
  return key;
}


// Core Execution Engine
async function executeCommand(command) {

  // === PHASE 1: Commands that don't need any tab ===
  if (command.action === 'tab_list') {
    try {
      const allTabs = await chrome.tabs.query({});
      replyToAgent('tab_list_result', { tabs: allTabs.map(t => ({ id: t.id, title: t.title, url: t.url, active: t.active })) });
    } catch (error) {
      replyToAgent('error', { message: error.message });
    }
    return;
  }

  if (command.action === 'tab_new') {
    try {
      const newTab = await chrome.tabs.create({ url: command.url || 'about:blank', active: true });
      replyToAgent('tab_new_done', { tabId: newTab.id });
    } catch (error) {
      replyToAgent('error', { message: error.message });
    }
    return;
  }

  // === PHASE 2: Get active tab ===
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (tabs.length === 0) return;
  const tabId = tabs[0].id;
  currentTabId = tabId;

  // === PHASE 3: Commands that need a tab but NOT the debugger ===
  if (command.action === 'navigate') {
    try {
      await chrome.tabs.update(tabId, { url: command.url });
      replyToAgent('navigate_done', { url: command.url });
    } catch (error) {
      replyToAgent('error', { message: error.message });
    }
    return;
  }

  if (command.action === 'scan') {
    try {
      // Inject perception script
      chrome.scripting.executeScript({
        target: { tabId },
        files: ["content.js"]
      }, () => {
        if (chrome.runtime.lastError) {
          replyToAgent("error", { message: "Failed to inject content script: " + chrome.runtime.lastError.message });
          return;
        }
        // Ping content script to extract DOM & draw Set-of-Marks
        chrome.tabs.sendMessage(tabId, { type: "PERCEIVE_DOM" }, (marks) => {
          if (chrome.runtime.lastError) {
            replyToAgent("error", { message: "Failed to communicate with content script: " + chrome.runtime.lastError.message });
            return;
          }
          // Add small delay to ensure DOM redraws visual marks before capture
          setTimeout(() => {
            chrome.tabs.captureVisibleTab(null, { format: "jpeg", quality: 60 }, (screenshotUrl) => {
              if (chrome.runtime.lastError) {
                // Clear marks anyway even if screenshot fails
                chrome.tabs.sendMessage(tabId, { type: "CLEAR_MARKS" }, () => {
                  const _ = chrome.runtime.lastError;
                });
                replyToAgent("error", { message: "Failed to capture screenshot: " + chrome.runtime.lastError.message });
                return;
              }
              // Immediately clear marks after taking screenshot for stealth
              chrome.tabs.sendMessage(tabId, { type: "CLEAR_MARKS" }, () => {
                const _ = chrome.runtime.lastError;
              });
              replyToAgent("scan_result", { marks: marks || [], screenshot: screenshotUrl });
            });
          }, 100);
        });
      });
    } catch (error) {
      replyToAgent('error', { message: error.message });
    }
    return;
  }

  if (command.action === 'upload_file') {
    try {
      const doc = await chrome.debugger.sendCommand({ tabId }, 'DOM.getDocument', {});
      const node = await chrome.debugger.sendCommand({ tabId }, 'DOM.querySelector', { nodeId: doc.root.nodeId, selector: command.selector });
      if (node.nodeId) {
        await chrome.debugger.sendCommand({ tabId }, 'DOM.setFileInputFiles', { nodeId: node.nodeId, files: [command.filePath] });
        replyToAgent('upload_file_done', { success: true });
      } else {
        replyToAgent('upload_file_done', { success: false, error: 'Node not found' });
      }
    } catch(e) {
      replyToAgent('upload_file_done', { success: false, error: e.message });
    }
  }

  if (command.action === 'extract_text') {
    try {
      const res = await chrome.scripting.executeScript({
        target: { tabId },
        func: (selector) => {
          if (!selector) return document.body.innerText;
          const el = document.querySelector(selector);
          return el ? el.innerText : null;
        },
        args: [command.selector || null]
      });
      replyToAgent('extract_text_done', { text: res[0]?.result });
    } catch (e) {
      replyToAgent('error', { message: e.message });
    }
  }

  if (command.action === 'get_attributes') {
    try {
      const res = await chrome.scripting.executeScript({
        target: { tabId },
        func: (selector) => {
          const el = document.querySelector(selector);
          if (!el) return null;
          const attrs = {};
          for (const attr of el.attributes) {
            attrs[attr.name] = attr.value;
          }
          return attrs;
        },
        args: [command.selector]
      });
      replyToAgent('get_attributes_done', { attributes: res[0]?.result });
    } catch (e) {
      replyToAgent('error', { message: e.message });
    }
  }

  if (command.action === 'scroll_to_element') {
    try {
      const res = await chrome.scripting.executeScript({
        target: { tabId },
        func: (selector) => {
          const el = document.querySelector(selector);
          if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); return true; }
          return false;
        },
        args: [command.selector]
      });
      replyToAgent('scroll_to_element_done', { success: res[0]?.result });
    } catch (e) {
      replyToAgent('error', { message: e.message });
    }
  }

  if (command.action === 'get_html') {
    try {
      const res = await chrome.scripting.executeScript({
        target: { tabId },
        func: (selector) => {
          if (selector) {
            const el = document.querySelector(selector);
            return el ? el.outerHTML : "Element not found";
          }
          return document.documentElement.outerHTML;
        },
        args: [command.selector || null]
      });
      replyToAgent("get_html_done", { html: res[0]?.result });
    } catch (error) {
      replyToAgent('error', { message: error.message });
    }
    return;
  }

  if (command.action === 'set_value') {
    try {
      const setRes = await chrome.scripting.executeScript({
        target: { tabId },
        func: (selector, value) => {
          const el = document.querySelector(selector);
          if (!el) return { success: false, error: 'Element not found: ' + selector };
          const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
            || Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
          if (nativeSetter) nativeSetter.call(el, value);
          else el.value = value;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          return { success: true };
        },
        args: [command.selector, command.value]
      });
      replyToAgent('set_value_done', setRes[0]?.result || { success: false, error: 'Script failed' });
    } catch (error) {
      replyToAgent('error', { message: error.message });
    }
    return;
  }

  if (command.action === 'clear_value') {
    try {
      const clearRes = await chrome.scripting.executeScript({
        target: { tabId },
        func: (selector) => {
          const el = document.querySelector(selector);
          if (!el) return { success: false, error: 'Element not found: ' + selector };
          const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
            || Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
          if (nativeSetter) nativeSetter.call(el, '');
          else el.value = '';
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          return { success: true };
        },
        args: [command.selector]
      });
      replyToAgent('clear_value_done', clearRes[0]?.result || { success: false, error: 'Script failed' });
    } catch (error) {
      replyToAgent('error', { message: error.message });
    }
    return;
  }

  if (command.action === 'select_option') {
    try {
      const optRes = await chrome.scripting.executeScript({
        target: { tabId },
        func: (selector, value) => {
          const el = document.querySelector(selector);
          if (!el) return { success: false, error: 'Element not found: ' + selector };
          if (!el.options) return { success: false, error: 'Element is not a <select>: ' + selector };
          let found = false;
          for (const opt of el.options) {
            if (opt.value === value || opt.textContent.trim() === value) {
              el.value = opt.value;
              found = true;
              break;
            }
          }
          if (!found) return { success: false, error: 'Option not found: ' + value };
          el.dispatchEvent(new Event('change', { bubbles: true }));
          return { success: true };
        },
        args: [command.selector, command.value]
      });
      replyToAgent('select_option_done', optRes[0]?.result || { success: false, error: 'Script failed' });
    } catch (error) {
      replyToAgent('error', { message: error.message });
    }
    return;
  }

  if (command.action === 'check') {
    try {
      const checkRes = await chrome.scripting.executeScript({
        target: { tabId },
        func: (selector, checked) => {
          const el = document.querySelector(selector);
          if (!el) return { success: false, error: 'Element not found: ' + selector };
          el.checked = checked;
          el.dispatchEvent(new Event('change', { bubbles: true }));
          el.dispatchEvent(new Event('click', { bubbles: true }));
          return { success: true };
        },
        args: [command.selector, command.checked]
      });
      replyToAgent('check_done', checkRes[0]?.result || { success: false, error: 'Script failed' });
    } catch (error) {
      replyToAgent('error', { message: error.message });
    }
    return;
  }

  if (command.action === 'focus') {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        func: (selector) => {
          const el = document.querySelector(selector);
          if (el) el.focus();
        },
        args: [command.selector]
      });
      replyToAgent('focus_done', {});
    } catch (error) {
      replyToAgent('error', { message: error.message });
    }
    return;
  }

  if (command.action === 'screenshot') {
    chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 80 }, (screenshotUrl) => {
      if (chrome.runtime.lastError) {
        replyToAgent('error', { message: 'Screenshot failed: ' + chrome.runtime.lastError.message });
        return;
      }
      replyToAgent('screenshot_result', { screenshot: screenshotUrl });
    });
    return;
  }

  if (command.action === 'tab_close') {
    try {
      await chrome.tabs.remove(tabId);
      replyToAgent('tab_close_done', {});
    } catch (error) {
      replyToAgent('error', { message: error.message });
    }
    return;
  }

  if (command.action === 'tab_switch') {
    try {
      await chrome.tabs.update(command.tabId, { active: true });
      const switchTab = await chrome.tabs.get(command.tabId);
      await chrome.windows.update(switchTab.windowId, { focused: true });
      replyToAgent('tab_switch_done', { tabId: command.tabId });
    } catch (error) {
      replyToAgent('error', { message: error.message });
    }
    return;
  }

  if (command.action === 'go_back') {
    try {
      await chrome.tabs.goBack(tabId);
      replyToAgent('go_back_done', {});
    } catch (error) {
      replyToAgent('error', { message: error.message });
    }
    return;
  }

  if (command.action === 'go_forward') {
    try {
      await chrome.tabs.goForward(tabId);
      replyToAgent('go_forward_done', {});
    } catch (error) {
      replyToAgent('error', { message: error.message });
    }
    return;
  }

  if (command.action === 'reload') {
    try {
      await chrome.tabs.reload(tabId);
      replyToAgent('reload_done', {});
    } catch (error) {
      replyToAgent('error', { message: error.message });
    }
    return;
  }

  if (command.action === 'get_page_info') {
    try {
      const pageTab = await chrome.tabs.get(tabId);
      replyToAgent('get_page_info_result', { url: pageTab.url, title: pageTab.title });
    } catch (error) {
      replyToAgent('error', { message: error.message });
    }
    return;
  }

  // === PHASE 4: Commands that need the debugger ===
  try {
    await chrome.debugger.attach({ tabId }, "1.3");
  } catch (e) {
    // Already attached or forbidden URL
  }

  try {
    if (command.action === 'click') {
      const { x, y } = command;
      // Stealth physical simulation: mouse moved, pressed, released
      await chrome.debugger.sendCommand({ tabId }, "Input.dispatchMouseEvent", {
        type: "mouseMoved", x, y
      });
      await chrome.debugger.sendCommand({ tabId }, "Input.dispatchMouseEvent", {
        type: "mousePressed", x, y, button: "left", clickCount: 1
      });
      await new Promise(r => setTimeout(r, 50)); // slight human press delay
      await chrome.debugger.sendCommand({ tabId }, "Input.dispatchMouseEvent", {
        type: "mouseReleased", x, y, button: "left", clickCount: 1
      });
      replyToAgent("click_done", { x, y });
    }
    else if (command.action === 'double_click') {
      const { x, y } = command;
      await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
      await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
      await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
      await new Promise(r => setTimeout(r, 50));
      await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 2 });
      await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 2 });
      replyToAgent('double_click_done', { x, y });
    }
    else if (command.action === 'triple_click') {
      const { x, y } = command;
      await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
      // First click
      await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
      await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
      await new Promise(r => setTimeout(r, 30));
      // Second click
      await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 2 });
      await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 2 });
      await new Promise(r => setTimeout(r, 30));
      // Third click
      await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 3 });
      await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 3 });
      replyToAgent('triple_click_done', { x, y });
    }
    else if (command.action === 'right_click') {
      const { x, y } = command;
      await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
      await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'right', clickCount: 1 });
      await new Promise(r => setTimeout(r, 50));
      await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'right', clickCount: 1 });
      replyToAgent('right_click_done', { x, y });
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
    else if (command.action === 'select_all') {
      // Ctrl+A key down
      await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchKeyEvent', {
        type: 'rawKeyDown', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, nativeVirtualKeyCode: 65, modifiers: 2
      });
      await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchKeyEvent', {
        type: 'keyUp', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, nativeVirtualKeyCode: 65, modifiers: 2
      });
      replyToAgent('select_all_done', {});
    }
    else if (command.action === 'keyboard_shortcut') {
      const { key, ctrl, alt, shift, meta } = command;
      const modifiers = (alt ? 1 : 0) | (ctrl ? 2 : 0) | (meta ? 4 : 0) | (shift ? 8 : 0);
      const keyCode = getVirtualKeyCode(key);
      const code = getKeyCode(key);
      await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchKeyEvent', {
        type: 'rawKeyDown', key: key.length === 1 ? key : key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode, modifiers
      });
      if (key.length === 1) {
        await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchKeyEvent', {
          type: 'char', text: key, key, code, windowsVirtualKeyCode: keyCode, modifiers
        });
      }
      await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchKeyEvent', {
        type: 'keyUp', key: key.length === 1 ? key : key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode, modifiers
      });
      replyToAgent('keyboard_shortcut_done', { key, ctrl, alt, shift, meta });
    }
    else if (command.action === 'drag') {
      const { fromX, fromY, toX, toY } = command;
      const steps = command.steps || 10;
      // Move to start
      await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', { type: 'mouseMoved', x: fromX, y: fromY });
      // Press
      await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', { type: 'mousePressed', x: fromX, y: fromY, button: 'left', clickCount: 1 });
      // Move in steps
      for (let i = 1; i <= steps; i++) {
        const x = Math.round(fromX + (toX - fromX) * (i / steps));
        const y = Math.round(fromY + (toY - fromY) * (i / steps));
        await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
        await new Promise(r => setTimeout(r, 16));
      }
      // Release
      await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', { type: 'mouseReleased', x: toX, y: toY, button: 'left', clickCount: 1 });
      replyToAgent('drag_done', { fromX, fromY, toX, toY });
    }
    else if (command.action === 'eval_js') {
      const result = await chrome.debugger.sendCommand({ tabId }, 'Runtime.evaluate', {
        expression: command.code,
        returnByValue: true,
        awaitPromise: true,
        userGesture: true
      });
      const value = result.result?.value !== undefined ? result.result.value : (result.result?.description || null);
      if (result.exceptionDetails) {
        replyToAgent('eval_js_done', { result: 'Error: ' + (result.exceptionDetails.text || result.exceptionDetails.exception?.description || 'Unknown error') });
      } else {
        replyToAgent('eval_js_done', { result: value });
      }
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
