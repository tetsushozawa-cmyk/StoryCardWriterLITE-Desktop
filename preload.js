const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopFiles', Object.freeze({
  open: () => ipcRenderer.invoke('file:open'),
  save: (filePath, content) => ipcRenderer.invoke('file:save', { filePath, content }),
  saveAs: (content, suggestedName) => ipcRenderer.invoke('file:save-as', { content, suggestedName }),
  setDirty: (dirty) => ipcRenderer.send('app:dirty-state', Boolean(dirty)),
  onCommand: (handler) => {
    if (typeof handler !== 'function') return;
    ipcRenderer.on('app:command', (_event, command) => handler(command));
  },
  onOpenFile: (handler) => {
    if (typeof handler !== 'function') return;
    ipcRenderer.on('app:open-file', (_event, result) => handler(result));
  },
}));
