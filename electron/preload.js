const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  ping: () => 'pong',
  getPaths: () => ipcRenderer.invoke('get-paths')
});
