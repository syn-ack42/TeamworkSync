const { contextBridge, ipcRenderer } = require('electron')

//console.log("prelaod")

contextBridge.exposeInMainWorld('electronAPI', {
  open_file_dialog: () => ipcRenderer.invoke('open-file-dialog'),
  open_file_drop: (file) => ipcRenderer.invoke('open-file-drop', file),
  register_set_table: (callback) => ipcRenderer.on('set-table-data', callback),
  register_set_config: (callback) => ipcRenderer.on('set-config', callback),
  register_set_errors: (callback) => ipcRenderer.on('set-errors', callback),
  store_config: (conf) => ipcRenderer.invoke('store-config', conf),
  submit_to_teamwork: () => ipcRenderer.invoke('submit-to-teamwork'),
})

