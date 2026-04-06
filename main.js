const { app, BrowserWindow } = require("electron");
const path = require("path");
const startServer = require("./server");

let server;

async function createWindow() {

  server = await startServer();

  const win = new BrowserWindow({
    width: 900,
    height: 800,
    icon: path.join(__dirname, "logo.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadURL("http://127.0.0.1:3000");

  // Abrir DevTools para debugging
  win.webContents.openDevTools();

  win.setMenuBarVisibility(false);
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (server) server.close();
  if (process.platform !== "darwin") app.quit();
});
