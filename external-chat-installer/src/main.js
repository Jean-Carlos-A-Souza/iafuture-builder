const { app, BrowserWindow, nativeImage, globalShortcut, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

function readRuntimeConfig() {
  const configPath = path.join(__dirname, '..', 'chat-app.config.json');

  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (_error) {
    return {};
  }
}

function resolveAppName(config) {
  const value = typeof config.chatAppName === 'string' ? config.chatAppName.trim() : '';
  return value !== '' ? value : 'Chat Desktop';
}

const runtimeConfig = readRuntimeConfig();
const runtimeAppName = resolveAppName(runtimeConfig);
const rendererReactEntry = path.join(__dirname, 'renderer-dist', 'index.html');
const rendererLegacyEntry = path.join(__dirname, 'renderer', 'index.html');

app.setName(runtimeAppName);

function createWindow() {
  const iconPath = path.join(__dirname, 'renderer', 'assets', 'icon.png');
  const icon = nativeImage.createFromPath(iconPath);
  const configArg = encodeURIComponent(JSON.stringify(runtimeConfig));
  const hasReactBundle = fs.existsSync(rendererReactEntry);

  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 640,
    show: false,
    backgroundColor: '#090b0f',
    autoHideMenuBar: true,
    title: runtimeAppName,
    icon: icon.isEmpty() ? undefined : icon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      additionalArguments: [`--kryon-config=${configArg}`],
    },
  });

  let currentRenderer = hasReactBundle ? 'react' : 'legacy';
  let readySignaled = false;
  let fallbackAttempted = false;

  const loadRenderer = (target) => {
    currentRenderer = target;
    const entry = target === 'react' ? rendererReactEntry : rendererLegacyEntry;
    return win.loadFile(entry);
  };

  const fallbackToLegacy = (reason, details = {}) => {
    if (fallbackAttempted || currentRenderer === 'legacy' || !fs.existsSync(rendererLegacyEntry) || win.isDestroyed()) {
      return;
    }

    fallbackAttempted = true;
    readySignaled = false;
    console.error('renderer-fallback', { reason, details });
    loadRenderer('legacy').catch((error) => {
      console.error('renderer-fallback-load-error', {
        message: error instanceof Error ? error.message : String(error),
      });
    });
  };

  loadRenderer(currentRenderer).catch((error) => {
    console.error('renderer-load-error', {
      renderer: currentRenderer,
      message: error instanceof Error ? error.message : String(error),
    });
    fallbackToLegacy('initial-load-error');
  });

  win.once('ready-to-show', () => {
    if (!win.isDestroyed() && !win.isVisible()) {
      win.show();
      win.focus();
    }
  });

  win.webContents.on('did-finish-load', () => {
    if (!win.isDestroyed() && !win.isVisible()) {
      win.show();
      win.focus();
    }
  });

  win.webContents.on('did-fail-load', (_event, code, description, url) => {
    console.error('did-fail-load', { renderer: currentRenderer, code, description, url });
    if (currentRenderer === 'react') {
      fallbackToLegacy('did-fail-load', { code, description, url });
    }
  });

  win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    console.log('renderer-console', { level, message, line, sourceId });
  });

  win.webContents.on('render-process-gone', (_event, details) => {
    console.error('render-process-gone', { renderer: currentRenderer, details });
    if (currentRenderer === 'react') {
      fallbackToLegacy('render-process-gone', details);
    }
  });

  const handleRendererReady = () => {
    readySignaled = true;
  };

  const readyTimeout = setTimeout(() => {
    if (!readySignaled && currentRenderer === 'react') {
      fallbackToLegacy('renderer-ready-timeout', { timeoutMs: 12000 });
    }
  }, 12000);

  const handleRendererReadyIpc = () => {
    handleRendererReady();
  };

  ipcMain.on('kryon-renderer-ready', handleRendererReadyIpc);

  win.on('closed', () => {
    clearTimeout(readyTimeout);
    ipcMain.removeListener('kryon-renderer-ready', handleRendererReadyIpc);
  });

  return win;
}

app.whenReady().then(() => {
  createWindow();

  globalShortcut.register('CommandOrControl+Shift+I', () => {
    const window = BrowserWindow.getFocusedWindow();
    if (window) {
      window.webContents.openDevTools({ mode: 'detach' });
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
