const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const net = require('net');
const { spawn } = require('child_process');
const { WebSocketServer } = require('ws');

let mainWindow = null;
let isRunInProgress = false;

const getCsvOutputDir = () => path.join(__dirname, 'csv_output');

const ensureCsvOutputDir = () => {
  const dir = getCsvOutputDir();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

const getFreePort = () =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });

const createWindow = () => {
  ensureCsvOutputDir();

  mainWindow = new BrowserWindow({
    title: 'SMH Blockly',
    width: 1120,
    height: 840,
    backgroundColor: '#f4f8f7',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
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

  ipcMain.handle('run-backend', async () => {
    if (!mainWindow) {
      throw new Error('run-backend: window not ready');
    }
    if (isRunInProgress) {
      throw new Error('Run already in progress');
    }

    isRunInProgress = true;

    const csvPath = path.join(getCsvOutputDir(), 'compiled.csv');
    const backendDir = path.join(__dirname, '..', 'backend');
    const runnerScript = path.join(backendDir, 'runner.py');

    try {
      if (!fs.existsSync(csvPath)) {
        throw new Error('compiled.csv not found — click Compile first.');
      }

      try {
        const size = fs.statSync(csvPath).size;
        if (!size) {
          throw new Error('compiled.csv is empty — recompile.');
        }

        // Attempt read so Windows lock errors (EBUSY) can be surfaced early.
        fs.readFileSync(csvPath, { encoding: 'utf8' });
      } catch (e) {
        if (e && e.code === 'EBUSY') {
          throw new Error(
            'compiled.csv is locked (EBUSY). Close it in Excel or another app, then try Run again.'
          );
        }
        throw e;
      }

      const port = await getFreePort();
      const wsUrl = `ws://127.0.0.1:${port}`;

      let runCompleteSent = false;
      const wsServer = new WebSocketServer({ host: '127.0.0.1', port });

      wsServer.on('connection', (socket) => {
        socket.on('message', (data) => {
          try {
            const text = data && data.toString ? data.toString('utf8') : String(data);
            const payload = JSON.parse(text);
            if (!payload || !payload.type) return;

            if (payload.type === 'block_result') {
              mainWindow.webContents.send('block-result', payload);
              return;
            }

            if (payload.type === 'run_complete') {
              runCompleteSent = true;
              isRunInProgress = false;
              mainWindow.webContents.send('run-complete', payload);
              try {
                wsServer.close();
              } catch {
                // ignore
              }
            }
          } catch {
            // Ignore invalid WS frames.
          }
        });
      });

      const venvPythonPath = path.join(backendDir, '.venv', 'Scripts', 'python.exe');
      const pythonPath = fs.existsSync(venvPythonPath) ? venvPythonPath : 'python';

      const child = spawn(
        pythonPath,
        [runnerScript, '--csv', csvPath, '--ws', wsUrl],
        { cwd: backendDir, windowsHide: true }
      );

      child.stdout.on('data', (d) => {
        const s = d.toString('utf8').trim();
        if (s) console.log(`[python stdout] ${s}`);
      });
      child.stderr.on('data', (d) => {
        const s = d.toString('utf8').trim();
        if (s) console.error(`[python stderr] ${s}`);
      });

      child.on('exit', (code) => {
        if (!runCompleteSent) {
          mainWindow.webContents.send('run-complete', {
            type: 'run_complete',
            ok: false,
            stoppedEarly: true,
            reason: `Python exited with code ${code}`
          });
        }

        try {
          wsServer.close();
        } catch {
          // ignore
        }
        isRunInProgress = false;
      });

      child.on('error', (err) => {
        isRunInProgress = false;
        try {
          wsServer.close();
        } catch {
          // ignore
        }
        mainWindow.webContents.send('run-complete', {
          type: 'run_complete',
          ok: false,
          stoppedEarly: true,
          reason: err && err.message ? err.message : String(err)
        });
      });

      return { ok: true, wsUrl };
    } catch (err) {
      isRunInProgress = false;
      throw err;
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
