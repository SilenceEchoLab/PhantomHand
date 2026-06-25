document.addEventListener('DOMContentLoaded', () => {
  const wsUrlInput = document.getElementById('ws-url');
  const saveBtn = document.getElementById('save-btn');
  const statusDot = document.getElementById('status-dot');

  // Load existing
  chrome.storage.local.get(['wsUrl', 'connectionStatus'], (data) => {
    if (data.wsUrl) {
      wsUrlInput.value = data.wsUrl;
    } else {
      wsUrlInput.value = 'ws://localhost:37210';
    }
    if (data.connectionStatus === 'connected') {
      statusDot.classList.add('connected');
    }
  });

  // Keep synced with background script updates
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.connectionStatus) {
      if (changes.connectionStatus.newValue === 'connected') {
        statusDot.classList.add('connected');
      } else {
        statusDot.classList.remove('connected');
      }
    }
  });

  saveBtn.addEventListener('click', () => {
    const url = wsUrlInput.value.trim();
    if (url) {
      chrome.storage.local.set({ wsUrl: url });
      // Notify background script to reconnect
      chrome.runtime.sendMessage({ action: 'reconnect' });
      saveBtn.innerText = "Connecting...";
      setTimeout(() => { saveBtn.innerText = "Connect to Agent Server"; }, 1000);
    }
  });
});
