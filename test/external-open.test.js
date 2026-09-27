const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

test('macOSビルドへscw文書の編集関連付けを登録する', () => {
  const packageJson = require('../package.json');

  assert.deepEqual(packageJson.build.fileAssociations, [{
    ext: 'scw',
    name: 'StoryCardWriter Document',
    description: 'StoryCardWriter文書',
    role: 'Editor',
  }]);
});

test('ready前のopen-fileを保持しRenderer準備後に渡す', () => {
  const mainSource = fs.readFileSync(path.join(root, 'main.js'), 'utf8');

  assert.match(mainSource, /app\.on\('open-file',[\s\S]*pendingOpenFiles\.push\(filePath\)/);
  assert.match(mainSource, /webContents\.on\('did-finish-load',[\s\S]*rendererIsReady = true;[\s\S]*flushPendingOpenFiles\(\)/);
  assert.match(mainSource, /webContents\.send\('app:open-file', await readStoryFile\(filePath\)\)/);
});

test('外部ファイルとアプリ内の開くが共通読込を使用する', () => {
  const mainSource = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
  const preloadSource = fs.readFileSync(path.join(root, 'preload.js'), 'utf8');
  const rendererSource = fs.readFileSync(path.join(root, 'renderer.js'), 'utf8');
  const reader = mainSource.slice(
    mainSource.indexOf('async function readStoryFile'),
    mainSource.indexOf('async function flushPendingOpenFiles'),
  );

  assert.match(reader, /fs\.readFile\(filePath, 'utf8'\)/);
  assert.match(reader, /authorizedPaths\.add\(filePath\)/);
  assert.match(mainSource, /ipcMain\.handle\('file:open',[\s\S]*return readStoryFile\(result\.filePaths\[0\]\)/);
  assert.match(preloadSource, /onOpenFile:[\s\S]*ipcRenderer\.on\('app:open-file'/);
  assert.match(rendererSource, /function applyOpenedFile[\s\S]*codec\.parse\(result\.content\)[\s\S]*currentFilePath = result\.filePath/);
  assert.match(rendererSource, /async function openExternalFile[\s\S]*confirmDiscardChanges\(\)[\s\S]*applyOpenedFile\(result\)/);
});

test('外部ファイルは単一ウインドウを前面化し同じパスへ保存できる', () => {
  const mainSource = fs.readFileSync(path.join(root, 'main.js'), 'utf8');

  assert.match(mainSource, /function createWindow\(\) \{\s*if \(mainWindow && !mainWindow\.isDestroyed\(\)\) return;/);
  assert.match(mainSource, /if \(mainWindow\.isMinimized\(\)\) mainWindow\.restore\(\);\s*mainWindow\.show\(\);\s*mainWindow\.focus\(\);/);
  assert.match(mainSource, /async function readStoryFile[\s\S]*authorizedPaths\.add\(filePath\)/);
  assert.match(mainSource, /ipcMain\.handle\('file:save',[\s\S]*authorizedPaths\.has\(filePath\)[\s\S]*writeJsonAtomically\(filePath, payload\.content\)/);
});
