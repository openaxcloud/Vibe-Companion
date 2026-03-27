const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("ecodeDesktop", {
  platform: process.platform,
  isDesktopApp: true,
  getVersion: () => ipcRenderer.invoke("get-app-version"),
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  onUpdateAvailable: (callback) => {
    ipcRenderer.on("update-available", (_event, info) => callback(info));
  },
  onUpdateDownloaded: (callback) => {
    ipcRenderer.on("update-downloaded", (_event, info) => callback(info));
  },
  installUpdate: () => ipcRenderer.invoke("install-update"),
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
});
