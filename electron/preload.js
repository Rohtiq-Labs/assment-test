const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  ping: () => 'pong',
  getPaths: () => ipcRenderer.invoke('get-paths'),
  saveCompiledCsv: (rows) => ipcRenderer.invoke('save-compiled-csv', rows),
  runBackend: () => ipcRenderer.invoke('run-backend'),
  onBlockResult: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('block-result', listener);
    return () => ipcRenderer.removeListener('block-result', listener);
  },
  onRunComplete: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('run-complete', listener);
    return () => ipcRenderer.removeListener('run-complete', listener);
  }
});
