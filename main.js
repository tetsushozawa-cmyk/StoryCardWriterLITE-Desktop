const { app, BrowserWindow, dialog, ipcMain, Menu } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');

const authorizedPaths = new Set();
const pendingOpenFiles = [];
let mainWindow = null;
let rendererIsReady = false;
let isFlushingOpenFiles = false;
let rendererIsDirty = false;
let allowWindowClose = false;

app.setName('StoryCardWriter LITE');

app.on('open-file', (event, filePath) => {
  event.preventDefault();
  pendingOpenFiles.push(filePath);
  flushPendingOpenFiles();
  if (app.isReady() && (!mainWindow || mainWindow.isDestroyed())) createWindow();
});

function sendCommand(command) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('app:command', command);
}

function createApplicationMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    }] : []),
    {
      label: 'ファイル',
      submenu: [
        { label: '新規作成', accelerator: 'CmdOrCtrl+N', click: () => sendCommand('new') },
        { label: '開く…', accelerator: 'CmdOrCtrl+O', click: () => sendCommand('open') },
        { type: 'separator' },
        { label: '保存', accelerator: 'CmdOrCtrl+S', click: () => sendCommand('save') },
        { label: '名前を付けて保存…', accelerator: 'CmdOrCtrl+Shift+S', click: () => sendCommand('save-as') },
        ...(!isMac ? [{ type: 'separator' }, { role: 'quit' }] : []),
      ],
    },
    {
      label: '編集',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
        { type: 'separator' },
        { label: '検索…', accelerator: 'CmdOrCtrl+F', click: () => sendCommand('find') },
      ],
    },
    {
      label: 'ウインドウ',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [{ type: 'separator' }, { role: 'front' }] : [{ role: 'close' }]),
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) return;
  rendererIsReady = false;
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 900,
    minWidth: 760,
    minHeight: 640,
    backgroundColor: '#f7f7f5',
    title: 'StoryCardWriter LITE',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: !app.isPackaged,
    },
  });

  mainWindow.loadFile('index.html');

  mainWindow.webContents.on('did-finish-load', () => {
    rendererIsReady = true;
    flushPendingOpenFiles();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    rendererIsReady = false;
  });

  mainWindow.on('close', async (event) => {
    if (allowWindowClose || !rendererIsDirty) return;
    event.preventDefault();
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: '未保存の変更があります',
      message: '保存していない変更があります。終了しますか？',
      detail: '「終了」を選ぶと、保存していない変更は失われます。',
      buttons: ['キャンセル', '終了'],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    });
    if (result.response === 1) {
      allowWindowClose = true;
      mainWindow.close();
    }
  });
}

function ensureDocumentExtension(filePath) {
  return /\.(?:scw|json)$/i.test(filePath) ? filePath : `${filePath}.scw`;
}

function validateJsonText(jsonText) {
  if (typeof jsonText !== 'string') throw new Error('保存内容が不正です。');
  JSON.parse(jsonText);
}

async function writeJsonAtomically(filePath, content) {
  const temporaryPath = `${filePath}.tmp-${process.pid}`;
  try {
    await fs.writeFile(temporaryPath, content, 'utf8');
    await fs.rename(temporaryPath, filePath);
  } catch (error) {
    await fs.rm(temporaryPath, { force: true }).catch(() => {});
    throw error;
  }
}

async function readStoryFile(requestedPath) {
  const filePath = path.resolve(requestedPath);
  const content = await fs.readFile(filePath, 'utf8');
  authorizedPaths.add(filePath);
  return { canceled: false, filePath, fileName: path.basename(filePath), content };
}

async function flushPendingOpenFiles() {
  if (isFlushingOpenFiles || !rendererIsReady || !mainWindow || mainWindow.isDestroyed()) return;
  isFlushingOpenFiles = true;
  try {
    while (pendingOpenFiles.length > 0 && mainWindow && !mainWindow.isDestroyed()) {
      const filePath = pendingOpenFiles.shift();
      try {
        mainWindow.webContents.send('app:open-file', await readStoryFile(filePath));
      } catch (error) {
        mainWindow.webContents.send('app:open-file', {
          filePath,
          fileName: path.basename(filePath),
          errorMessage: error.message,
        });
      }
    }
  } finally {
    isFlushingOpenFiles = false;
  }
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

ipcMain.handle('file:open', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'StoryCardWriterファイルを開く',
    properties: ['openFile'],
    filters: [
      { name: 'StoryCardWriterファイル', extensions: ['scw', 'json'] },
      { name: 'すべてのファイル', extensions: ['*'] },
    ],
  });
  if (result.canceled || result.filePaths.length === 0) return { canceled: true };

  return readStoryFile(result.filePaths[0]);
});

ipcMain.handle('file:save', async (_event, payload) => {
  const filePath = path.resolve(String(payload?.filePath || ''));
  if (!authorizedPaths.has(filePath)) throw new Error('この保存先は許可されていません。');
  validateJsonText(payload?.content);
  await writeJsonAtomically(filePath, payload.content);
  return { filePath, fileName: path.basename(filePath) };
});

ipcMain.handle('file:save-as', async (_event, payload) => {
  validateJsonText(payload?.content);
  const defaultName = String(payload?.suggestedName || 'untitled.scw')
    .replace(/[\\/:*?"<>|]/g, '_');
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '名前を付けて保存',
    defaultPath: defaultName,
    filters: [{ name: 'StoryCardWriterファイル', extensions: ['scw', 'json'] }],
  });
  if (result.canceled || !result.filePath) return { canceled: true };

  const filePath = path.resolve(ensureDocumentExtension(result.filePath));
  await writeJsonAtomically(filePath, payload.content);
  authorizedPaths.add(filePath);
  return { canceled: false, filePath, fileName: path.basename(filePath) };
});

ipcMain.on('app:dirty-state', (_event, dirty) => {
  rendererIsDirty = Boolean(dirty);
});

app.whenReady().then(() => {
  createApplicationMenu();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
