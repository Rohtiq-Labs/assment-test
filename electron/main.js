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
    width: 1100,
    height: 820,
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

  ipcMain.handle('save-compiled-csv', (_event, rows) => {
    if (!Array.isArray(rows)) {
      throw new Error('save-compiled-csv: rows must be an array');
    }
    ensureCsvOutputDir();
    const filePath = path.join(getCsvOutputDir(), 'compiled.csv');

    const escapeCell = (value) => {
      const s = String(value);
      if (/[",\n\r]/.test(s)) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const header = 'block_id,block_type,params,order_index';
    const lines = [header];
    for (const row of rows) {
      const paramsJson = JSON.stringify(row.params);
      lines.push(
        [
          escapeCell(row.block_id),
          escapeCell(row.block_type),
          escapeCell(paramsJson),
          escapeCell(row.order_index)
        ].join(',')
      );
    }
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
    return { ok: true, filePath };
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
