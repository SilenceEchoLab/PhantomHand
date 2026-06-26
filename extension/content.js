// Perception engine injected into the target page
(function() {
  if (window.__phantomHandInitialized) {
    return;
  }
  window.__phantomHandInitialized = true;

  let activeVisualMarks = [];

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "PERCEIVE_DOM") {
      clearVisualMarks(); // Clean up existing

      // Recursive function to find elements including shadow DOM
      function findAllInteractableElements(root) {
        let elements = [];
        const selector = 'a, button, input, textarea, select, [role="button"], [tabindex]:not([tabindex="-1"])';
        
        if (root.querySelectorAll) {
          elements.push(...Array.from(root.querySelectorAll(selector)));
        }

        const allChildren = root.querySelectorAll ? root.querySelectorAll('*') : [];
        for (const child of allChildren) {
          if (child.shadowRoot) {
            elements.push(...findAllInteractableElements(child.shadowRoot));
          }
        }
        return elements;
      }

      // Clean DOM noise to save token context and remove obstructions
      function cleanDomNoise() {
        const noiseSelectors = [
          '[id*="cookie" i]', '[class*="cookie" i]',
          '[id*="banner" i]', '[class*="banner" i]',
          '[id*="ad-" i]', '[class*="ad-" i]',
          'iframe[src*="ads"]',
          '#gdpr', '.gdpr',
          '[id*="popup" i]', '[class*="popup" i]'
        ];
        noiseSelectors.forEach(selector => {
          document.querySelectorAll(selector).forEach(el => {
            el.style.display = 'none';
          });
        });
      }
      
      cleanDomNoise();

      // Using A11y heuristic approach: looking for interactive elements
      const elements = findAllInteractableElements(document);
      const marksData = [];
      
      let currentId = 1;

      elements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        
        // Filter out invisible, zero-sized elements or obscured elements
        if (rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none' && style.opacity > 0) {
          const x = Math.round(rect.left + rect.width / 2);
          const y = Math.round(rect.top + rect.height / 2);
          
          marksData.push({
            id: currentId,
            tag: el.tagName.toLowerCase(),
            role: el.getAttribute('role') || '',
            text: (el.innerText || el.value || el.placeholder || el.ariaLabel || '').trim().substring(0, 80),
            type: el.getAttribute('type') || '',
            x,
            y
          });

          // Draw Set-of-Mark onto the screen for the Vision block
          const overlay = document.createElement('div');
          overlay.setAttribute('data-agy-mark', 'true');
          overlay.innerText = currentId.toString();
          
          // Stylish precise bounds
          overlay.style.position = 'absolute';
          overlay.style.left = (rect.left + window.scrollX) + 'px';
          overlay.style.top = (rect.top + window.scrollY) + 'px';
          overlay.style.border = '2px solid rgba(239, 68, 68, 0.8)'; // Tailwind red-500
          overlay.style.backgroundColor = 'rgba(15, 23, 42, 0.8)'; // Tailwind slate-900
          overlay.style.color = '#fff';
          overlay.style.fontSize = '12px';
          overlay.style.fontWeight = 'bold';
          overlay.style.padding = '0 4px';
          overlay.style.zIndex = '2147483647'; // Maximum z-index
          overlay.style.pointerEvents = 'none'; // Don't block physical clicks
          
          document.body.appendChild(overlay);
          activeVisualMarks.push(overlay);
          
          currentId++;
        }
      });

      sendResponse(marksData);
      return true;
    }
    
    if (request.type === "CLEAR_MARKS") {
      clearVisualMarks();
    }
  });

  function clearVisualMarks() {
    activeVisualMarks.forEach(el => el.remove());
    activeVisualMarks = [];
    // Failsafe catch
    document.querySelectorAll('[data-agy-mark="true"]').forEach(el => el.remove());
  }
})();
