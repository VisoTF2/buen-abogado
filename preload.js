window.addEventListener("DOMContentLoaded", () => {});
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  abrirVideo: (url) => ipcRenderer.send("abrir-video", url)
});
