const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const getCsvOutputDir = () => path.join(__dirname, 'csv_output');

const ensureCsvOutputDir = () => {
  const dir = getCsvOutputDir();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

const createWindow = () => {
  ensureCsvOutputDir();

  const win = new BrowserWindow({
    width: 960,
    height: 720,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile(path.join(__dirname, 'index.html'));
};

app.whenReady().then(() => {
  createWindow();

  ipcMain.handle('get-paths', () => ({
    csvOutputDir: getCsvOutputDir(),
    backendDir: path.join(__dirname, '..', 'backend'),
    runnerScript: path.join(__dirname, '..', 'backend', 'runner.py')
  }));

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
