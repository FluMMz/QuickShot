// QuickShot Content Script - Syntax korrigiert
class QuickShotContent {
  constructor() {
    this.isInitialized = false;
    this.currentTool = 'arrow';
    this.init();
  }

  init() {
    if (this.isInitialized) {
      console.log('QuickShotContent bereits initialisiert');
      return;
    }

    console.log('QuickShotContent wird initialisiert...');
    this.isInitialized = true;

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log('Content Script Message erhalten:', request.action);
      
      try {
        if (request.action === 'copyToClipboard') {
          this.copyToClipboard(request.text).then((success) => {
            sendResponse({ success });
          });
          return true;
        } else if (request.action === 'showScreenshotSelector') {
          console.log('Zeige Screenshot-Selector...');
          this.showScreenshotSelector(request.dataUrl);
          sendResponse({ success: true });
        } else if (request.action === 'showUploadingNotification') {
          this.showUploadingNotification();
          sendResponse({ success: true });
        } else if (request.action === 'showUploadError') {
          this.showUploadError();
          sendResponse({ success: true });
        } else if (request.action === 'showImageSuccess') {
          this.showImageSuccessWithClick(request.url);
          sendResponse({ success: true });
        } else if (request.action === 'showImageError') {
          this.showImageError(request.message);
          sendResponse({ success: true });
        } else {
          console.log('Unbekannte Action:', request.action);
          sendResponse({ success: false, error: 'Unknown action' });
        }
      } catch (error) {
        console.error('Fehler beim Verarbeiten der Message:', error);
        sendResponse({ success: false, error: error.message });
      }
      
      return true;
    });

    this.setupScreenshotFeedback();
    
    setTimeout(() => {
      try {
        chrome.runtime.sendMessage({ action: 'contentScriptReady' }, (response) => {
          console.log('Content Script Bereitschaft gemeldet');
        });
      } catch (e) {
        console.log('Bereitschafts-Signal konnte nicht gesendet werden');
      }
    }, 50);
  }

  showScreenshotSelector(fullScreenDataUrl) {
    console.log('Screenshot-Selector wird angezeigt...');
    
    this.removeSelector();

    const overlay = document.createElement('div');
    overlay.id = 'quickshot-selector';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(0, 0, 0, 0.4); z-index: 999999; cursor: crosshair; user-select: none;
    `;

    const preview = document.createElement('img');
    preview.src = fullScreenDataUrl;
    preview.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      object-fit: contain; pointer-events: none; opacity: 0.8;
    `;

    const selectionBox = document.createElement('div');
    selectionBox.id = 'selection-box';
    selectionBox.style.cssText = `
      position: absolute; border: 2px solid #3b82f6; background: rgba(59, 130, 246, 0.1);
      backdrop-filter: blur(2px); display: none; pointer-events: none;
      box-shadow: 0 0 20px rgba(59, 130, 246, 0.3);
    `;

    const controlPanel = document.createElement('div');
    controlPanel.style.cssText = `
      position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.9); backdrop-filter: blur(10px);
      padding: 16px 24px; border-radius: 12px; color: white;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      display: flex; gap: 12px; align-items: center; z-index: 1000000;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    `;

    controlPanel.innerHTML = `
      <span style="font-size: 14px; margin-right: 8px;">Bereich auswählen</span>
      <button id="edit-btn" style="
        background: linear-gradient(135deg, #8b5cf6, #7c3aed); color: white; border: none;
        padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 14px;
        font-weight: 500; transition: all 0.2s; opacity: 0.5; transform: scale(1);
      " disabled>Edit</button>
      <button id="upload-btn" style="
        background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; border: none;
        padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 14px;
        font-weight: 500; transition: all 0.2s; opacity: 0.5; transform: scale(1);
      " disabled>Upload</button>
      <button id="cancel-btn" style="
        background: rgba(255, 255, 255, 0.1); color: white;
        border: 1px solid rgba(255, 255, 255, 0.3); padding: 8px 16px;
        border-radius: 6px; cursor: pointer; font-size: 14px; transition: all 0.2s;
      ">Abbrechen</button>
    `;

    overlay.appendChild(preview);
    overlay.appendChild(selectionBox);
    overlay.appendChild(controlPanel);
    document.body.appendChild(overlay);

    console.log('Overlay erstellt, initialisiere Drag & Drop...');

    let isSelecting = false;
    let startX, startY;

    const mouseDownHandler = (e) => {
      console.log('Mouse down auf', e.target.tagName, e.target.id);
      if (e.target === overlay || e.target === preview) {
        console.log('Starte Drag-Auswahl...');
        isSelecting = true;
        startX = e.clientX;
        startY = e.clientY;
        selectionBox.style.left = startX + 'px';
        selectionBox.style.top = startY + 'px';
        selectionBox.style.width = '0px';
        selectionBox.style.height = '0px';
        selectionBox.style.display = 'block';
        overlay.style.cursor = 'crosshair';
      }
    };

    const mouseMoveHandler = (e) => {
      if (!isSelecting) return;
      
      const endX = e.clientX;
      const endY = e.clientY;
      const width = Math.abs(endX - startX);
      const height = Math.abs(endY - startY);
      const left = Math.min(startX, endX);
      const top = Math.min(startY, endY);

      selectionBox.style.left = left + 'px';
      selectionBox.style.top = top + 'px';
      selectionBox.style.width = width + 'px';
      selectionBox.style.height = height + 'px';

      const uploadBtn = document.getElementById('upload-btn');
      const editBtn = document.getElementById('edit-btn');
      
      if (width > 20 && height > 20) {
        uploadBtn.disabled = false;
        uploadBtn.style.opacity = '1';
        uploadBtn.style.cursor = 'pointer';
        
        editBtn.disabled = false;
        editBtn.style.opacity = '1';
        editBtn.style.cursor = 'pointer';
      } else {
        uploadBtn.disabled = true;
        uploadBtn.style.opacity = '0.5';
        uploadBtn.style.cursor = 'not-allowed';
        
        editBtn.disabled = true;
        editBtn.style.opacity = '0.5';
        editBtn.style.cursor = 'not-allowed';
      }
    };

    const mouseUpHandler = () => {
      if (isSelecting) {
        console.log('Drag beendet');
        isSelecting = false;
        overlay.style.cursor = 'default';
      }
    };

    overlay.addEventListener('mousedown', mouseDownHandler);
    document.addEventListener('mousemove', mouseMoveHandler);
    document.addEventListener('mouseup', mouseUpHandler);

    // Upload-Handler
    document.getElementById('upload-btn').addEventListener('click', async () => {
      console.log('Upload-Button geklickt');
      if (!selectionBox.style.display || selectionBox.style.display === 'none') {
        console.log('Keine Auswahl vorhanden');
        return;
      }

      try {
        const rect = selectionBox.getBoundingClientRect();
        console.log('Selection rect:', rect);
        
        const uploadBtn = document.getElementById('upload-btn');
        uploadBtn.innerHTML = 'Verarbeite...';
        uploadBtn.disabled = true;
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = () => {
          console.log('Image loaded, processing...');
          const scaleX = img.naturalWidth / preview.offsetWidth;
          const scaleY = img.naturalHeight / preview.offsetHeight;
          
          canvas.width = rect.width * scaleX;
          canvas.height = rect.height * scaleY;
          
          ctx.drawImage(
            img,
            rect.left * scaleX,
            rect.top * scaleY,
            rect.width * scaleX,
            rect.height * scaleY,
            0, 0,
            canvas.width,
            canvas.height
          );
          
          const croppedDataUrl = canvas.toDataURL('image/png', 0.92);
          console.log('Cropped image created, sending to background...');
          
          chrome.runtime.sendMessage({
            action: 'uploadCroppedScreenshot',
            dataUrl: croppedDataUrl,
            originalDataUrl: fullScreenDataUrl
          });
          
          this.removeSelector();
        };
        
        img.onerror = (e) => {
          console.error('Image load error:', e);
        };
        
        img.src = fullScreenDataUrl;
        
      } catch (error) {
        console.error('Upload handler error:', error);
      }
    });

    // Edit-Handler
    document.getElementById('edit-btn').addEventListener('click', async () => {
      console.log('Edit-Button geklickt');
      
      if (!selectionBox.style.display || selectionBox.style.display === 'none') {
        console.log('Keine Auswahl vorhanden');
        return;
      }

      try {
        const rect = selectionBox.getBoundingClientRect();
        console.log('Opening annotation editor for rect:', rect);
        
        const editBtn = document.getElementById('edit-btn');
        editBtn.innerHTML = 'Öffne Editor...';
        editBtn.disabled = true;
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = () => {
          console.log('Image loaded for annotation editor');
          const scaleX = img.naturalWidth / preview.offsetWidth;
          const scaleY = img.naturalHeight / preview.offsetHeight;
          
          canvas.width = rect.width * scaleX;
          canvas.height = rect.height * scaleY;
          
          ctx.drawImage(
            img,
            rect.left * scaleX,
            rect.top * scaleY,
            rect.width * scaleX,
            rect.height * scaleY,
            0, 0,
            canvas.width,
            canvas.height
          );
          
          const croppedDataUrl = canvas.toDataURL('image/png', 0.92);
          console.log('Cropped image created, opening annotation editor');
          
          this.removeSelector();
          this.openSimpleAnnotationEditor(croppedDataUrl, fullScreenDataUrl);
        };
        
        img.onerror = (e) => {
          console.error('Image load error for annotation:', e);
        };
        
        img.src = fullScreenDataUrl;
        
      } catch (error) {
        console.error('Edit handler error:', error);
      }
    });

    // Cancel-Handler
    document.getElementById('cancel-btn').addEventListener('click', () => {
      console.log('Cancel-Button geklickt');
      this.removeSelector();
    });

    // ESC-Handler
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        console.log('ESC gedrückt');
        this.removeSelector();
      }
    };
    document.addEventListener('keydown', escHandler);

    overlay._cleanup = () => {
      console.log('Cleanup Event-Listener...');
      document.removeEventListener('mousemove', mouseMoveHandler);
      document.removeEventListener('mouseup', mouseUpHandler);
      document.removeEventListener('keydown', escHandler);
    };

    console.log('Screenshot-Selector vollständig initialisiert');
  }

  openSimpleAnnotationEditor(croppedImageUrl, originalImageUrl) {
    console.log('Öffne einfachen Annotation-Editor...');
    
    const editorOverlay = document.createElement('div');
    editorOverlay.id = 'annotation-editor';
    editorOverlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(0, 0, 0, 0.9); z-index: 999999;
      display: flex; justify-content: center; align-items: center; font-family: system-ui;
    `;

    const container = document.createElement('div');
    container.style.cssText = `
      background: white; border-radius: 12px; overflow: hidden;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
      max-width: 90vw; max-height: 90vh; display: flex; flex-direction: column;
    `;

    const toolbar = document.createElement('div');
    toolbar.style.cssText = `
      background: linear-gradient(135deg, #667eea, #764ba2); color: white;
      padding: 16px 20px; display: flex; justify-content: space-between; align-items: center;
    `;

    toolbar.innerHTML = `
      <div style="display: flex; align-items: center; gap: 16px;">
        <span style="font-weight: bold; font-size: 16px;">Screenshot bearbeiten</span>
        <div style="display: flex; gap: 8px;">
          <button class="tool-btn active" data-tool="arrow" style="
            background: rgba(255,255,255,0.3); border: none; color: white;
            padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 14px;
          ">Pfeil</button>
          <button class="tool-btn" data-tool="text" style="
            background: rgba(255,255,255,0.2); border: none; color: white;
            padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 14px;
          ">Text</button>
          <button class="tool-btn" data-tool="rect" style="
            background: rgba(255,255,255,0.2); border: none; color: white;
            padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 14px;
          ">Box</button>
        </div>
      </div>
      <div style="display: flex; gap: 12px;">
        <button id="done-btn" style="
          background: linear-gradient(135deg, #10b981, #059669); color: white;
          border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer;
          font-weight: 500; font-size: 14px;
        ">Fertig & Upload</button>
        <button id="cancel-annotation" style="
          background: rgba(255,255,255,0.2); color: white;
          border: 1px solid rgba(255,255,255,0.3); padding: 10px 20px;
          border-radius: 6px; cursor: pointer; font-size: 14px;
        ">Abbrechen</button>
      </div>
    `;

    const canvasArea = document.createElement('div');
    canvasArea.style.cssText = `
      background: #f8f9fa; padding: 20px; display: flex;
      justify-content: center; align-items: center; position: relative;
    `;

    const canvas = document.createElement('canvas');
    canvas.style.cssText = `
      border: 2px solid #e2e8f0; border-radius: 8px; cursor: crosshair;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1); background: white;
    `;

    canvasArea.appendChild(canvas);
    container.appendChild(toolbar);
    container.appendChild(canvasArea);
    editorOverlay.appendChild(container);
    document.body.appendChild(editorOverlay);

    this.setupSimpleCanvas(canvas, croppedImageUrl, originalImageUrl);

    console.log('Annotation-Editor geöffnet');
  }

  setupSimpleCanvas(canvas, croppedImageUrl, originalImageUrl) {
    const ctx = canvas.getContext('2d');
    const img = new Image();
    let annotations = [];
    let currentTool = 'arrow';
    let isDrawing = false;
    let startX, startY;

    img.onload = () => {
      const maxWidth = Math.min(800, window.innerWidth * 0.7);
      const maxHeight = Math.min(600, window.innerHeight * 0.6);
      const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
      
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      
      this.redrawCanvas(ctx, img, annotations);
    };

    // Tool-Switching
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tool-btn').forEach(b => {
          b.style.background = 'rgba(255,255,255,0.2)';
          b.classList.remove('active');
        });
        e.target.style.background = 'rgba(255,255,255,0.3)';
        e.target.classList.add('active');
        currentTool = e.target.dataset.tool;
        console.log('Tool gewechselt zu:', currentTool);
      });
    });

    canvas.addEventListener('mousedown', (e) => {
      const rect = canvas.getBoundingClientRect();
      startX = e.clientX - rect.left;
      startY = e.clientY - rect.top;
      isDrawing = true;
      console.log('Start drawing:', currentTool);
    });

    canvas.addEventListener('mousemove', (e) => {
      if (!isDrawing) return;
      
      const rect = canvas.getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;
      
      this.redrawCanvas(ctx, img, annotations);
      this.drawPreview(ctx, currentTool, startX, startY, currentX, currentY);
    });

    canvas.addEventListener('mouseup', (e) => {
      if (!isDrawing) return;
      
      const rect = canvas.getBoundingClientRect();
      const endX = e.clientX - rect.left;
      const endY = e.clientY - rect.top;
      
      let annotation = {
        tool: currentTool,
        startX, startY, endX, endY,
        color: '#ef4444'
      };

      if (currentTool === 'text') {
        const text = prompt('Text eingeben:');
        if (text) {
          annotation.text = text;
          annotations.push(annotation);
        }
      } else {
        annotations.push(annotation);
      }
      
      this.redrawCanvas(ctx, img, annotations);
      isDrawing = false;
      
      console.log('Annotation hinzugefügt:', annotation);
    });

    document.getElementById('done-btn').addEventListener('click', () => {
      console.log('Finalisiere annotiertes Bild...');
      
      const finalImageUrl = canvas.toDataURL('image/png', 0.92);
      
      chrome.runtime.sendMessage({
        action: 'uploadCroppedScreenshot',
        dataUrl: finalImageUrl,
        originalDataUrl: originalImageUrl
      });
      
      this.closeAnnotationEditor();
    });

    document.getElementById('cancel-annotation').addEventListener('click', () => {
      this.closeAnnotationEditor();
    });

    img.src = croppedImageUrl;
  }

  redrawCanvas(ctx, img, annotations) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.drawImage(img, 0, 0, ctx.canvas.width, ctx.canvas.height);
    
    annotations.forEach(ann => {
      ctx.strokeStyle = ann.color;
      ctx.fillStyle = ann.color;
      ctx.lineWidth = 3;
      
      if (ann.tool === 'arrow') {
        this.drawArrow(ctx, ann.startX, ann.startY, ann.endX, ann.endY);
      } else if (ann.tool === 'rect') {
        ctx.strokeRect(ann.startX, ann.startY, ann.endX - ann.startX, ann.endY - ann.startY);
      } else if (ann.tool === 'text' && ann.text) {
        ctx.font = '16px Arial';
        ctx.fillText(ann.text, ann.startX, ann.startY);
      }
    });
  }

  drawPreview(ctx, tool, startX, startY, currentX, currentY) {
    ctx.strokeStyle = '#ef4444';
    ctx.fillStyle = '#ef4444';
    ctx.lineWidth = 3;
    
    if (tool === 'arrow') {
      this.drawArrow(ctx, startX, startY, currentX, currentY);
    } else if (tool === 'rect') {
      ctx.strokeRect(startX, startY, currentX - startX, currentY - startY);
    }
  }

  drawArrow(ctx, fromX, fromY, toX, toY) {
    const headLength = 15;
    const angle = Math.atan2(toY - fromY, toX - fromX);
    
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - headLength * Math.cos(angle - Math.PI / 6), toY - headLength * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - headLength * Math.cos(angle + Math.PI / 6), toY - headLength * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
  }

  closeAnnotationEditor() {
    const editor = document.getElementById('annotation-editor');
    if (editor) {
      console.log('Schließe Annotation-Editor...');
      editor.style.opacity = '0';
      setTimeout(() => {
        if (editor.parentNode) editor.remove();
      }, 300);
    }
  }

  removeSelector() {
    const selector = document.getElementById('quickshot-selector');
    if (selector) {
      console.log('Entferne Screenshot-Selector...');
      if (selector._cleanup) {
        selector._cleanup();
      }
      selector.remove();
    }
  }

  async copyToClipboard(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        this.showCopySuccess(text);
        return true;
      }
      
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.cssText = 'position: fixed; left: -9999px;';
      document.body.appendChild(textArea);
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      
      if (successful) {
        this.showCopySuccess(text);
        return true;
      } else {
        this.showCopyError(text);
        return false;
      }
    } catch (error) {
      console.error('Clipboard error:', error);
      this.showCopyError(text);
      return false;
    }
  }

  showCopySuccess(url) {
    console.log('Zeige Copy-Success für:', url);
    this.showNotification('Link kopiert!', 'linear-gradient(135deg, #10b981, #059669)', 3000);
  }

  showCopyError(url) {
    console.log('Zeige Copy-Error für:', url);
    this.showNotification('Kopieren fehlgeschlagen', 'linear-gradient(135deg, #ef4444, #dc2626)', 5000);
  }

  showImageSuccessWithClick(url) {
    console.log('Zeige Image-Success mit Click für:', url);
    
    const existing = document.querySelector('.quickshot-notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = 'quickshot-notification';
    notification.style.cssText = `
      position: fixed; top: 20px; right: 20px; z-index: 1000001;
      background: linear-gradient(135deg, #10b981, #059669); color: white;
      padding: 16px 20px; border-radius: 8px; cursor: pointer;
      box-shadow: 0 4px 20px rgba(16, 185, 129, 0.4);
      font-family: system-ui; font-size: 14px; font-weight: 500;
      transform: translateX(100px); opacity: 0; transition: all 0.3s ease;
    `;
    
    const shortUrl = url.length > 50 ? url.substring(0, 47) + '...' : url;
    notification.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <span style="font-size: 20px;">✅</span>
        <div>
          <div style="font-weight: bold;">Screenshot hochgeladen!</div>
          <div style="font-size: 12px; opacity: 0.9; margin-top: 4px;">
            ${this.escapeHtml(shortUrl)}
          </div>
          <div style="font-size: 11px; opacity: 0.8; margin-top: 4px;">
            Klick zum Öffnen
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.transform = 'translateX(0)';
      notification.style.opacity = '1';
    }, 10);
    
    notification.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'openImageInNewTab', url: url });
      notification.style.background = 'linear-gradient(135deg, #3b82f6, #1d4ed8)';
    });
    
    setTimeout(() => {
      if (notification.parentNode) {
        notification.style.transform = 'translateX(100px)';
        notification.style.opacity = '0';
        setTimeout(() => {
          if (notification.parentNode) notification.remove();
        }, 300);
      }
    }, 7000);
  }

  showImageError(message) {
    this.showNotification('Upload fehlgeschlagen: ' + message, 'linear-gradient(135deg, #ef4444, #dc2626)', 5000);
  }

  showNotification(message, background, duration) {
    const existing = document.querySelector('.quickshot-notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = 'quickshot-notification';
    notification.style.cssText = `
      position: fixed; top: 20px; right: 20px; z-index: 1000001;
      background: ${background}; color: white; padding: 16px 20px; border-radius: 8px;
      font-family: system-ui; font-size: 14px; font-weight: 500;
      transform: translateX(100px); opacity: 0; transition: all 0.3s ease;
    `;
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.transform = 'translateX(0)';
      notification.style.opacity = '1';
    }, 10);
    
    if (duration) {
      setTimeout(() => {
        if (notification.parentNode) {
          notification.style.transform = 'translateX(100px)';
          notification.style.opacity = '0';
          setTimeout(() => {
            if (notification.parentNode) notification.remove();
          }, 300);
        }
      }, duration);
    }
  }

  showUploadingNotification() {
    this.showNotification('Upload läuft...', 'linear-gradient(135deg, #3b82f6, #1d4ed8)', false);
  }

  showUploadError() {
    this.showNotification('Upload fehlgeschlagen', 'linear-gradient(135deg, #ef4444, #dc2626)', 3000);
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  setupScreenshotFeedback() {
    document.addEventListener('keydown', (event) => {
      if (event.ctrlKey && event.shiftKey && event.key === 'Q') {
        console.log('Screenshot-Hotkey erkannt!');
        event.preventDefault();
        chrome.runtime.sendMessage({ action: 'takeScreenshot' });
      }
    });
  }
}

// Content Script initialisieren
if (!window.quickShotContent) {
  console.log('Initialisiere QuickShot Content Script...');
  window.quickShotContent = new QuickShotContent();
} else {
  console.log('QuickShot Content Script bereits geladen');
}