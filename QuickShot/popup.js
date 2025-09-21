// QuickShot Popup Script - Korrigierte Version
class PopupManager {
  constructor() {
    this.init();
  }

  async init() {
    console.log('Popup wird initialisiert...');
    await this.loadStats();
    await this.loadHistory();
    await this.loadCurrentShortcut();
    this.bindEvents();
  }

  bindEvents() {
    // Screenshot-Button
    const screenshotBtn = document.getElementById('takeScreenshot');
    if (screenshotBtn) {
      screenshotBtn.addEventListener('click', () => {
        console.log('Screenshot-Button geklickt');
        this.takeScreenshot();
      });
    }

    // Shortcut-Änderungs-Button
    const changeShortcutBtn = document.getElementById('changeShortcut');
    if (changeShortcutBtn) {
      changeShortcutBtn.addEventListener('click', () => {
        console.log('Shortcut ändern geklickt');
        this.changeShortcut();
      });
    }

    // Aktueller Shortcut anzeigen (klickbar)
    const currentShortcutSpan = document.getElementById('currentShortcut');
    if (currentShortcutSpan) {
      currentShortcutSpan.addEventListener('click', () => {
        console.log('Shortcut-Span geklickt');
        this.changeShortcut();
      });
    }
  }

  async takeScreenshot() {
    const button = document.getElementById('takeScreenshot');
    const originalText = button.textContent;
    
    console.log('Starte Screenshot...');
    
    // Loading-Status anzeigen
    button.textContent = '📸 Wird aufgenommen...';
    button.disabled = true;
    button.style.opacity = '0.7';

    try {
      // Nachricht an Background Script senden
      const response = await chrome.runtime.sendMessage({ 
        action: 'takeScreenshot' 
      });
      
      console.log('Screenshot-Response:', response);
      
      // Erfolgs-Status anzeigen
      button.textContent = '✅ Erfolgreich!';
      button.style.background = 'linear-gradient(135deg, #10b981, #059669)';
      
      setTimeout(() => {
        button.textContent = originalText;
        button.disabled = false;
        button.style.opacity = '1';
        button.style.background = '';
        
        // Stats und Verlauf neu laden
        this.loadStats();
        this.loadHistory();
      }, 1500);
      
    } catch (error) {
      console.error('Screenshot fehlgeschlagen:', error);
      
      button.textContent = '❌ Fehler';
      button.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
      
      setTimeout(() => {
        button.textContent = originalText;
        button.disabled = false;
        button.style.opacity = '1';
        button.style.background = '';
      }, 2000);
    }
  }

  async changeShortcut() {
    try {
      console.log('Shortcut-Änderung wird versucht...');
      
      // Chrome-Einstellungsseite öffnen
      await chrome.runtime.sendMessage({ 
        action: 'updateShortcut',
        shortcut: null
      });
      
      // Feedback anzeigen
      const shortcutSpan = document.getElementById('currentShortcut');
      const originalText = shortcutSpan.textContent;
      
      shortcutSpan.textContent = '🔄 Öffne Einstellungen...';
      shortcutSpan.style.background = 'rgba(59, 130, 246, 0.3)';
      
      setTimeout(() => {
        shortcutSpan.textContent = originalText;
        shortcutSpan.style.background = '';
      }, 2000);
      
    } catch (error) {
      console.error('Shortcut-Änderung fehlgeschlagen:', error);
      
      const shortcutSpan = document.getElementById('currentShortcut');
      shortcutSpan.textContent = '❌ Fehler';
      shortcutSpan.style.background = 'rgba(239, 68, 68, 0.3)';
      
      setTimeout(() => {
        this.loadCurrentShortcut();
      }, 2000);
    }
  }

  async loadCurrentShortcut() {
    try {
      const shortcut = await chrome.runtime.sendMessage({ 
        action: 'getShortcut' 
      });
      
      const shortcutSpan = document.getElementById('currentShortcut');
      if (shortcutSpan) {
        shortcutSpan.textContent = shortcut || 'Nicht gesetzt';
      }
      
    } catch (error) {
      console.error('Shortcut konnte nicht geladen werden:', error);
      const shortcutSpan = document.getElementById('currentShortcut');
      if (shortcutSpan) {
        shortcutSpan.textContent = 'Fehler';
      }
    }
  }

  async loadStats() {
    try {
      console.log('Lade Statistiken...');
      
      // History aus Storage abrufen
      const result = await chrome.storage.local.get('history');
      const history = result && result.history ? result.history : [];
      
      console.log('History geladen:', history.length, 'Einträge');
      
      // Gesamtanzahl Screenshots
      const total = history.length;
      
      // Heutige Screenshots
      const today = new Date().toDateString();
      const todayCount = history.filter(item => {
        try {
          const itemDate = new Date(item.timestamp).toDateString();
          return itemDate === today;
        } catch (e) {
          return false;
        }
      }).length;

      // UI aktualisieren
      const totalElement = document.getElementById('totalScreenshots');
      const todayElement = document.getElementById('todayScreenshots');
      
      if (totalElement) totalElement.textContent = total;
      if (todayElement) todayElement.textContent = todayCount;
      
    } catch (error) {
      console.error('Stats konnten nicht geladen werden:', error);
      
      // Fallback-Werte
      const totalElement = document.getElementById('totalScreenshots');
      const todayElement = document.getElementById('todayScreenshots');
      
      if (totalElement) totalElement.textContent = '0';
      if (todayElement) todayElement.textContent = '0';
    }
  }

  async loadHistory() {
    try {
      console.log('Lade Verlauf...');
      
      // History aus Storage abrufen
      const result = await chrome.storage.local.get('history');
      const history = result && result.history ? result.history : [];
      
      const container = document.getElementById('historyContainer');
      if (!container) return;
      
      if (history.length === 0) {
        container.innerHTML = `
          <div style="text-align: center; opacity: 0.7; padding: 20px; font-size: 13px;">
            Noch keine Screenshots...
          </div>
        `;
        return;
      }

      // Die letzten 5 Einträge anzeigen
      const recentItems = history.slice(0, 5);
      
      container.innerHTML = recentItems.map(item => {
        const timeAgo = this.getTimeAgo(new Date(item.timestamp));
        const shortUrl = this.shortenUrl(item.url);
        
        return `
          <div class="history-item" data-url="${this.escapeHtml(item.url)}">
            <div class="history-thumbnail" style="background-image: url('${this.escapeHtml(item.thumbnail)}'); background-size: cover; background-position: center;"></div>
            <div class="history-info">
              <div class="history-url" title="${this.escapeHtml(item.url)}">${this.escapeHtml(shortUrl)}</div>
              <div class="history-time">${this.escapeHtml(timeAgo)}</div>
            </div>
          </div>
        `;
      }).join('');

      // Click-Listener für Verlaufs-Einträge hinzufügen
      container.querySelectorAll('.history-item').forEach(item => {
        item.addEventListener('click', () => {
          const url = item.dataset.url;
          this.copyToClipboard(url);
          this.showTemporaryFeedback(item, '✅ Kopiert!');
        });
      });
      
    } catch (error) {
      console.error('Verlauf konnte nicht geladen werden:', error);
      
      const container = document.getElementById('historyContainer');
      if (container) {
        container.innerHTML = `
          <div style="text-align: center; opacity: 0.7; padding: 20px; font-size: 13px;">
            Fehler beim Laden des Verlaufs...
          </div>
        `;
      }
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  getTimeAgo(date) {
    try {
      const now = new Date();
      const diffInMinutes = Math.floor((now - date) / (1000 * 60));
      
      if (diffInMinutes < 1) return 'Gerade eben';
      if (diffInMinutes < 60) return `${diffInMinutes}min`;
      if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h`;
      return `${Math.floor(diffInMinutes / 1440)}d`;
    } catch (error) {
      return 'Unbekannt';
    }
  }

  shortenUrl(url) {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.replace('www.', '');
      const path = urlObj.pathname;
      
      if (path.length > 20) {
        return `${domain}${path.substring(0, 17)}...`;
      }
      return `${domain}${path}`;
    } catch {
      return url.length > 30 ? url.substring(0, 27) + '...' : url;
    }
  }

  async copyToClipboard(text) {
    try {
      // Moderne Clipboard API versuchen
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
      
      // Fallback für ältere Browser
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      document.body.appendChild(textArea);
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      
      return successful;
    } catch (error) {
      console.error('Kopieren fehlgeschlagen:', error);
      return false;
    }
  }

  showTemporaryFeedback(element, message) {
    const original = element.innerHTML;
    const originalBg = element.style.background;
    
    element.innerHTML = `<div style="text-align: center; color: #4ade80;">${message}</div>`;
    element.style.background = 'rgba(74, 222, 128, 0.2)';
    
    setTimeout(() => {
      element.innerHTML = original;
      element.style.background = originalBg;
    }, 1000);
  }
}

// Popup initialisieren wenn DOM bereit ist
console.log('Popup Script geladen, warte auf DOM...');

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM geladen, initialisiere PopupManager...');
    new PopupManager();
  });
} else {
  console.log('DOM bereits geladen, initialisiere PopupManager...');
  new PopupManager();
}