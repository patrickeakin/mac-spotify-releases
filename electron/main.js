const { app, BrowserWindow, Menu, shell, dialog, ipcMain } = require('electron');
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
  const startUrl = isDev 
    ? 'http://localhost:3000' 
    : `file://${path.join(__dirname, '../build/index.html')}`;
  
  mainWindow.loadURL(startUrl);

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
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
ipcMain.handle('open-external', (event, url) => {
  shell.openExternal(url);
  return true;
});

ipcMain.handle('get-version', () => {
  return app.getVersion();
});