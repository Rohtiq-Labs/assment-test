const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  ping: () => 'pong',
  getPaths: () => ipcRenderer.invoke('get-paths'),
  saveCompiledCsv: (rows) => ipcRenderer.invoke('save-compiled-csv', rows)
});
