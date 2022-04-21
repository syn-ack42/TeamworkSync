const { contextBridge, ipcRenderer } = require('electron')

//console.log("prelaod")

contextBridge.exposeInMainWorld('electronAPI', {
  open_file_dialog: () => ipcRenderer.invoke('open-file-dialog'),
  open_file_drop: (file) => ipcRenderer.invoke('open-file-drop', file),
  set_table: (callback) => ipcRenderer.on('set-table-data', callback)
})

