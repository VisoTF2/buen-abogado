const { app, BrowserWindow } = require("electron");
const path = require("path");
const startServer = require("./server");

let mainWindow;
let server;

async function createWindow() {

  // ✅ Iniciar servidor como Live Server
  server = await startServer();

  mainWindow = new BrowserWindow({
    width: 900,
    height: 800,
    icon: path.join(__dirname, "logo.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // ✅ Cargar desde localhost en vez de file://
  mainWindow.loadURL("http://localhost:3000");

  mainWindow.setMenuBarVisibility(false);
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (server) server.close();
  if (process.platform !== "darwin") app.quit();
});