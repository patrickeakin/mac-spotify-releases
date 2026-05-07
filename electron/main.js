const { app, BrowserWindow, Menu, shell, dialog, ipcMain, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');

// Simple dev detection without external dependency
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Simple JSON storage implementation
class SimpleStore {
  constructor() {
    this.storePath = null;
    this.data = {};
  }

  init() {
    this.storePath = path.join(app.getPath('userData'), 'store.json');
    this.data = this.loadData();
  }

  loadData() {
    try {
      if (this.storePath && fs.existsSync(this.storePath)) {
        return JSON.parse(fs.readFileSync(this.storePath, 'utf8'));
      }
    } catch (error) {
      console.error('Error loading store:', error);
    }
    return {};
  }

  saveData() {
    try {
      if (this.storePath) {
        fs.writeFileSync(this.storePath, JSON.stringify(this.data, null, 2));
      }
    } catch (error) {
      console.error('Error saving store:', error);
    }
  }

  get(key) {
    return this.data[key];
  }

  set(key, value) {
    this.data[key] = value;
    this.saveData();
  }

  delete(key) {
    delete this.data[key];
    this.saveData();
  }

  clear() {
    this.data = {};
    this.saveData();
  }
}

// Initialize the store
const store = new SimpleStore();

let mainWindow;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: 'default',
    show: false // Don't show until ready
  });

  // Load the app
  const devPort = process.env.NUMU_DEV_PORT || '3000';
  const startUrl = isDev
    ? `http://localhost:${devPort}`
    : `file://${path.join(__dirname, '../build/index.html')}`;
  
  mainWindow.loadURL(startUrl);

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
  });

  // Log any errors
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
  });

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log('Console:', message);
  });

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // DevTools can be opened manually with Cmd+Option+I if needed
}

// Create menu
function createMenu() {
  const template = [
    {
      label: 'NUMU',
      submenu: [
        {
          label: 'About NUMU',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About NUMU',
              message: 'NUMU - Spotify Releases',
              detail: 'Track new releases from your followed Spotify artists'
            });
          }
        },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideothers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectall' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { 
          label: 'Refresh',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            mainWindow.webContents.reload();
          }
        },
        { role: 'toggledevtools' },
        { type: 'separator' },
        { role: 'resetzoom' },
        { role: 'zoomin' },
        { role: 'zoomout' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Register custom protocol for OAuth callback
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('numu', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('numu');
}

// Handle OAuth callback URL
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, focus our window instead
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();

      // Handle OAuth callback from protocol
      const url = commandLine.find((arg) => arg.startsWith('numu://'));
      if (url) {
        handleOAuthCallback(url);
      }
    }
  });

  // Handle macOS protocol handler
  app.on('open-url', (event, url) => {
    event.preventDefault();
    console.log('🔗 open-url event received:', url);
    handleOAuthCallback(url);
  });
}

function handleOAuthCallback(url) {
  console.log('🔄 handleOAuthCallback called with URL:', url);

  if (mainWindow && url.startsWith('numu://callback')) {
    console.log('✅ URL matches numu://callback pattern');

    // Check for query string (authorization code flow)
    const queryStart = url.indexOf('?');
    if (queryStart !== -1) {
      const queryString = url.substring(queryStart + 1);
      console.log('📋 Extracted query string:', queryString);
      console.log('📤 Sending oauth-callback to renderer');
      mainWindow.webContents.send('oauth-callback', queryString);
      return;
    }

    // Fallback: Check for hash fragment (implicit flow)
    const hashStart = url.indexOf('#');
    if (hashStart !== -1) {
      const hash = url.substring(hashStart + 1);
      console.log('📋 Extracted hash (implicit flow):', hash);
      console.log('📤 Sending oauth-callback to renderer');
      mainWindow.webContents.send('oauth-callback', hash);
      return;
    }

    console.log('❌ No query string or hash found in URL');
  } else {
    console.log('❌ URL does not match or mainWindow not ready');
    console.log('   mainWindow exists:', !!mainWindow);
    console.log('   URL starts with numu://callback:', url.startsWith('numu://callback'));
  }
}

// App event handlers
app.whenReady().then(() => {
  store.init(); // Initialize storage after app is ready
  createWindow();
  createMenu();

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

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
    shell.openExternal(navigationUrl);
  });
});

// IPC handlers for electron-store
ipcMain.handle('store-get', (event, key) => {
  return store.get(key);
});

ipcMain.handle('store-set', (event, key, value) => {
  store.set(key, value);
  return true;
});

ipcMain.handle('store-delete', (event, key) => {
  store.delete(key);
  return true;
});

ipcMain.handle('store-clear', () => {
  store.clear();
  return true;
});

// Other IPC handlers
ipcMain.handle('open-external', async (event, url) => {
  console.log('🌐 open-external called with:', url);
  try {
    await shell.openExternal(url);
    return true;
  } catch (error) {
    console.error('❌ Failed to open external URL:', error);
    return false;
  }
});

ipcMain.handle('get-version', () => {
  return app.getVersion();
});

// Secure storage IPC: encrypts via OS keychain when available; falls back to plaintext
// in the same store.json (with a flag) when not. Stored values are JSON-serialised.
ipcMain.handle('safe-storage-set', (event, key, value) => {
  try {
    const json = JSON.stringify(value);
    if (safeStorage.isEncryptionAvailable()) {
      const buf = safeStorage.encryptString(json);
      store.set(key, { encrypted: true, data: buf.toString('base64') });
    } else {
      console.warn('safeStorage encryption unavailable; storing plaintext for', key);
      store.set(key, { encrypted: false, data: value });
    }
    return true;
  } catch (error) {
    console.error('safe-storage-set failed:', error);
    return false;
  }
});

ipcMain.handle('safe-storage-get', (event, key) => {
  try {
    const raw = store.get(key);
    if (!raw) return null;
    if (raw.encrypted) {
      const buf = Buffer.from(raw.data, 'base64');
      return JSON.parse(safeStorage.decryptString(buf));
    }
    return raw.data;
  } catch (error) {
    console.error('safe-storage-get failed:', error);
    return null;
  }
});

ipcMain.handle('safe-storage-delete', (event, key) => {
  store.delete(key);
  return true;
});