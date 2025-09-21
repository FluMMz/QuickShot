// QuickShot Background Script - Ohne Chrome Notifications
class QuickShot {
  constructor() {
    this.imgurClientId = '8d26ccd12712fca';
    this.contentScriptCache = new Map();
    this.init();
  }

  init() {
    chrome.commands.onCommand.addListener((command) => {
      console.log('Command received:', command);
      if (command === 'take_screenshot') {
        this.takeScreenshot();
      }
    });

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log('Message received:', request.action, sender.tab?.id || 'no tab');
      
      if (request.action === 'takeScreenshot') {
        this.takeScreenshot();
        sendResponse({ success: true });
      } else if (request.action === 'uploadCroppedScreenshot') {
        this.uploadCroppedScreenshot(request.dataUrl, request.originalDataUrl);
        sendResponse({ success: true });
      } else if (request.action === 'getSettings') {
        this.getSettings().then(sendResponse);
        return true;
      } else if (request.action === 'updateSettings') {
        this.updateSettings(request.settings).then(sendResponse);
        return true;
      } else if (request.action === 'updateShortcut') {
        this.updateShortcut(request.shortcut).then(sendResponse);
        return true;
      } else if (request.action === 'getShortcut') {
        this.getShortcut().then(sendResponse);
        return true;
      } else if (request.action === 'contentScriptReady') {
        console.log('Content Script bereit auf Tab:', sender.tab?.id);
        if (sender.tab?.id) {
          this.contentScriptCache.set(sender.tab.id, true);
        }
        sendResponse({ success: true });
      } else if (request.action === 'openImageInNewTab') {
        chrome.tabs.create({ url: request.url });
        sendResponse({ success: true });
      }
    });

    chrome.tabs.onRemoved.addListener((tabId) => {
      this.contentScriptCache.delete(tabId);
    });
  }

  async takeScreenshot() {
    try {
      console.log('Screenshot wird aufgenommen...');
      
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab) {
        throw new Error('Kein aktiver Tab gefunden');
      }

      if (tab.url.startsWith('chrome://') || 
          tab.url.startsWith('chrome-extension://') ||
          tab.url.startsWith('edge://') ||
          tab.url.startsWith('about:')) {
        console.log('Chrome/System-Seite übersprungen');
        return;
      }

      const fullScreenDataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
        format: 'png',
        quality: 92
      });

      console.log('Screenshot erfasst, prüfe Content Script Status...');

      const isContentScriptReady = this.contentScriptCache.has(tab.id);
      
      if (isContentScriptReady) {
        console.log('Content Script bereits bereit, sende Message...');
        try {
          await chrome.tabs.sendMessage(tab.id, {
            action: 'showScreenshotSelector',
            dataUrl: fullScreenDataUrl
          });
          console.log('Message erfolgreich gesendet');
          return;
        } catch (error) {
          console.log('Cached Content Script antwortet nicht, wird neu injiziert...');
          this.contentScriptCache.delete(tab.id);
        }
      }

      await this.injectAndWaitForContentScript(tab.id, fullScreenDataUrl);

    } catch (error) {
      console.error('Screenshot fehlgeschlagen:', error);
    }
  }

  async injectAndWaitForContentScript(tabId, fullScreenDataUrl) {
    console.log('Injiziere Content Script...');
    
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      });

      console.log('Content Script injiziert, warte auf Bereitschafts-Signal...');

      const contentScriptReady = await this.waitForContentScriptReady(tabId, 5000);
      
      if (contentScriptReady) {
        console.log('Content Script ist bereit, sende Screenshot-Selector Message...');
        
        await chrome.tabs.sendMessage(tabId, {
          action: 'showScreenshotSelector',
          dataUrl: fullScreenDataUrl
        });
        
        console.log('Interaktiver Screenshot-Selector erfolgreich gesendet!');
      } else {
        console.log('Content Script antwortet nicht, verwende vereinfachten Fallback...');
        await this.simplifiedFallbackScreenshot(tabId, fullScreenDataUrl);
      }

    } catch (injectionError) {
      console.error('Content Script Injection fehlgeschlagen:', injectionError);
      await this.simplifiedFallbackScreenshot(tabId, fullScreenDataUrl);
    }
  }

  waitForContentScriptReady(tabId, timeout = 5000) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      
      const checkReady = () => {
        if (this.contentScriptCache.has(tabId)) {
          console.log('Content Script bereit nach', Date.now() - startTime, 'ms');
          resolve(true);
          return;
        }
        
        if (Date.now() - startTime > timeout) {
          console.log('Content Script Timeout nach', timeout, 'ms');
          resolve(false);
          return;
        }
        
        setTimeout(checkReady, 100);
      };
      
      checkReady();
    });
  }

  async simplifiedFallbackScreenshot(tabId, fullScreenDataUrl) {
    console.log('Verwende vereinfachten Fallback ohne Drag-and-Drop...');
    
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: (dataUrl) => {
          if (window.quickshotFallbackActive) return;
          window.quickshotFallbackActive = true;

          const notification = document.createElement('div');
          notification.style.cssText = `
            position: fixed; top: 20px; right: 20px; z-index: 999999;
            background: linear-gradient(135deg, #10b981, #059669); color: white;
            padding: 16px 20px; border-radius: 8px; font-family: system-ui;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3); font-size: 14px; font-weight: 500;
          `;
          notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px;">
              <span style="font-size: 18px;">📸</span>
              <div>
                <div style="font-weight: bold;">Vollbild-Screenshot aufgenommen!</div>
                <div style="font-size: 12px; opacity: 0.9; margin-top: 2px;">
                  Wird hochgeladen und Link kopiert...
                </div>
              </div>
            </div>
          `;
          
          document.body.appendChild(notification);
          
          setTimeout(() => {
            if (notification.parentNode) notification.remove();
            window.quickshotFallbackActive = false;
          }, 4000);

          chrome.runtime.sendMessage({
            action: 'uploadCroppedScreenshot',
            dataUrl: dataUrl,
            originalDataUrl: dataUrl
          }).catch(err => console.error('Upload-Message fehlgeschlagen:', err));
        },
        args: [fullScreenDataUrl]
      });
      
    } catch (fallbackError) {
      console.error('Vereinfachter Fallback fehlgeschlagen:', fallbackError);
      await this.uploadCroppedScreenshot(fullScreenDataUrl, fullScreenDataUrl);
    }
  }

  async uploadCroppedScreenshot(dataUrl, originalDataUrl) {
    try {
      console.log('Upload wird gestartet...');
      
      const imageUrl = await this.uploadToImgur(dataUrl);
      console.log('Upload erfolgreich:', imageUrl);

      await this.copyLinkToClipboard(imageUrl);
      await this.addToHistory(imageUrl, originalDataUrl);

      // Nur Browser-Notification, KEINE Chrome-Notification
      await this.showSuccessInBrowser(imageUrl);

    } catch (error) {
      console.error('Upload fehlgeschlagen:', error);
      await this.showErrorInBrowser('Upload fehlgeschlagen: ' + error.message);
    }
  }

  async showSuccessInBrowser(imageUrl) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (tab && !tab.url.startsWith('chrome://')) {
        await chrome.tabs.sendMessage(tab.id, {
          action: 'showImageSuccess',
          url: imageUrl
        });
      }
    } catch (error) {
      console.error('Browser-Erfolgs-Notification fehlgeschlagen:', error);
    }
  }

  async showErrorInBrowser(message) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (tab && !tab.url.startsWith('chrome://')) {
        await chrome.tabs.sendMessage(tab.id, {
          action: 'showImageError', 
          message: message
        });
      }
    } catch (error) {
      console.error('Browser-Fehler-Notification fehlgeschlagen:', error);
    }
  }

  async copyLinkToClipboard(url) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (tab && !tab.url.startsWith('chrome://')) {
        try {
          await chrome.tabs.sendMessage(tab.id, {
            action: 'copyToClipboard',
            text: url
          });
          console.log('Link über Content Script kopiert');
          return;
        } catch (e) {
          console.log('Content Script Kopieren fehlgeschlagen, versuche direkten Ansatz...');
        }
        
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: async (textToCopy) => {
            try {
              if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(textToCopy);
                console.log('Link erfolgreich kopiert (moderne API)');
              } else {
                const textArea = document.createElement('textarea');
                textArea.value = textToCopy;
                textArea.style.position = 'fixed';
                textArea.style.left = '-9999px';
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                console.log('Link erfolgreich kopiert (Fallback)');
              }
            } catch (err) {
              console.error('Kopieren fehlgeschlagen:', err);
            }
          },
          args: [url]
        });
      }
    } catch (error) {
      console.error('Clipboard-Kopieren komplett fehlgeschlagen:', error);
    }
  }

  async uploadToImgur(dataUrl) {
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
    
    const formData = new FormData();
    formData.append('image', base64Data);
    formData.append('type', 'base64');

    const response = await fetch('https://api.imgur.com/3/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Client-ID ${this.imgurClientId}`
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.data?.error || 'Unbekannter Upload-Fehler');
    }

    return data.data.link;
  }

  async getSettings() {
    const defaultSettings = {
      uploadService: 'imgur',
      imageQuality: 92,
      showNotifications: true,
      historyLimit: 50,
      shortcut: 'Ctrl+Shift+Q'
    };

    try {
      const result = await chrome.storage.sync.get(['settings']);
      return { ...defaultSettings, ...result.settings };
    } catch (error) {
      console.error('Einstellungen laden fehlgeschlagen:', error);
      return defaultSettings;
    }
  }

  async updateSettings(settings) {
    try {
      await chrome.storage.sync.set({ settings });
      return true;
    } catch (error) {
      console.error('Einstellungen speichern fehlgeschlagen:', error);
      return false;
    }
  }

  async getShortcut() {
    try {
      const commands = await chrome.commands.getAll();
      const screenshotCommand = commands.find(cmd => cmd.name === 'take_screenshot');
      return screenshotCommand ? screenshotCommand.shortcut || 'Nicht gesetzt' : 'Nicht gefunden';
    } catch (error) {
      console.error('Shortcut laden fehlgeschlagen:', error);
      return 'Fehler';
    }
  }

  async updateShortcut(shortcut) {
    try {
      chrome.tabs.create({
        url: 'chrome://extensions/shortcuts'
      });
      return true;
    } catch (error) {
      console.error('Shortcut-Seite öffnen fehlgeschlagen:', error);
      return false;
    }
  }

  async addToHistory(url, thumbnail) {
    try {
      const history = await this.getHistory();
      const newEntry = {
        id: Date.now(),
        url,
        thumbnail: thumbnail.substring(0, 1000),
        timestamp: new Date().toISOString(),
        domain: new URL(url).hostname
      };

      history.unshift(newEntry);
      
      const settings = await this.getSettings();
      if (history.length > settings.historyLimit) {
        history.splice(settings.historyLimit);
      }

      await chrome.storage.local.set({ history });
    } catch (error) {
      console.error('History speichern fehlgeschlagen:', error);
    }
  }

  async getHistory() {
    try {
      const result = await chrome.storage.local.get(['history']);
      return result.history || [];
    } catch (error) {
      console.error('History laden fehlgeschlagen:', error);
      return [];
    }
  }
}

console.log('QuickShot Background Script - Ohne Chrome Notifications wird initialisiert...');
new QuickShot();