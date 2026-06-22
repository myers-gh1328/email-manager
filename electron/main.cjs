const { app, BrowserWindow, dialog } = require('electron');
const { spawn } = require('node:child_process');
const { existsSync } = require('node:fs');
const { mkdir } = require('node:fs/promises');
const { join } = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');

let mainWindow;
let serverProcess;

function getServerEntry() {
  const candidates = app.isPackaged
    ? [
        join(process.resourcesPath, 'app.asar.unpacked', 'build', 'index.js'),
        join(process.resourcesPath, 'app.asar', 'build', 'index.js'),
        join(process.resourcesPath, 'app', 'build', 'index.js')
      ]
    : [join(app.getAppPath(), 'build', 'index.js')];

  const serverEntry = candidates.find((candidate) => existsSync(candidate));
  if (!serverEntry) {
    throw new Error('The desktop app server build was not found. Run npm run desktop:build first.');
  }
  return serverEntry;
}

function getPort() {
  if (process.env.PORT) return process.env.PORT;
  return String(30_000 + Math.floor(Math.random() * 10_000));
}

async function waitForServer(url) {
  const deadline = Date.now() + 30_000;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status < 500) return;
    } catch (error) {
      lastError = error;
    }
    await delay(250);
  }

  throw lastError ?? new Error('The local app server did not become ready in time.');
}

async function startServer() {
  const port = getPort();
  const dataDir = process.env.SCUBA_EMAIL_DATA_DIR ?? join(app.getPath('userData'), 'data');
  await mkdir(dataDir, { recursive: true });

  const serverEntry = getServerEntry();
  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    HOST: '127.0.0.1',
    PORT: port,
    SCUBA_EMAIL_DATA_DIR: dataDir
  };

  serverProcess = spawn(process.execPath, [serverEntry], {
    env,
    stdio: app.isPackaged ? 'ignore' : 'inherit',
    windowsHide: true
  });

  serverProcess.once('exit', (code, signal) => {
    serverProcess = undefined;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('server-exited', { code, signal });
    }
  });

  const url = `http://127.0.0.1:${port}`;
  await waitForServer(url);
  return url;
}

async function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 980,
    minHeight: 700,
    title: 'Training Communications Studio',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: join(__dirname, 'preload.cjs')
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = undefined;
  });

  await mainWindow.loadURL(url);
}

async function boot() {
  try {
    const url = await startServer();
    await createWindow(url);
  } catch (error) {
    dialog.showErrorBox(
      'Training Communications Studio could not start',
      error instanceof Error ? error.message : String(error)
    );
    app.quit();
  }
}

app.whenReady().then(boot);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('before-quit', () => {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill();
  }
});
