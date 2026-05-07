const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('HebrewGregorianDesktop', {
  files: {
    saveJson: async (opts) => {
      return await ipcRenderer.invoke('hg:save-json', opts ?? {})
    },
    openJson: async () => {
      return await ipcRenderer.invoke('hg:open-json')
    },
  },
  trial: {
    getStatus: async () => {
      return await ipcRenderer.invoke('hg:trial-status')
    },
  },
})

