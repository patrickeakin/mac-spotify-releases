const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Storage methods (we'll implement these later)
  store: {
    get: (key) => ipcRenderer.invoke('store-get', key),
    set: (key, value) => ipcRenderer.invoke('store-set', key, value),
    delete: (key) => ipcRenderer.invoke('store-delete', key),
    clear: () => ipcRenderer.invoke('store-clear')
  },

  // Secure (OS-keychain backed) storage for tokens
  secureStore: {
    get: (key) => ipcRenderer.invoke('safe-storage-get', key),
    set: (key, value) => ipcRenderer.invoke('safe-storage-set', key, value),
    delete: (key) => ipcRenderer.invoke('safe-storage-delete', key)
  },

  // System integration
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  // App info
  getVersion: () => ipcRenderer.invoke('get-version'),

  // OAuth callback handler. Returns an unsubscribe function so listeners can
  // be cleaned up (React StrictMode double-mounts useEffect, which would
  // otherwise stack up duplicate listeners).
  onOAuthCallback: (callback) => {
    const wrapped = (event, payload) => callback(payload);
    ipcRenderer.on('oauth-callback', wrapped);
    return () => ipcRenderer.removeListener('oauth-callback', wrapped);
  }
});