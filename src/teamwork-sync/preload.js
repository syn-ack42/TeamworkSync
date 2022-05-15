const { contextBridge, ipcRenderer } = require('electron')

//console.log("prelaod")

contextBridge.exposeInMainWorld('electronAPI', {
  registerSetAppState: (callback) => ipcRenderer.on('set-app-state', callback),
  appReset: () => ipcRenderer.invoke('app-reset'),
  passwordEntered: (pwd) => ipcRenderer.invoke('pwd-entered', pwd),
  resetPassword: () => ipcRenderer.invoke('reset-password'),
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  openFileDrop: (file) => ipcRenderer.invoke('open-file-drop', file),
  registerSetTable: (callback) => ipcRenderer.on('set-table-data', callback),
  registerSetConfig: (callback) => ipcRenderer.on('set-config', callback),
  registerSetErrors: (callback) => ipcRenderer.on('set-errors', callback),
  storeConfig: (conf) => ipcRenderer.invoke('store-config', conf),
  submitToTeamwork: () => ipcRenderer.invoke('submit-to-teamwork'),
})

