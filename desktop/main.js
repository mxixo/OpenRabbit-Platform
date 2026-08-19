const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1024,
    minHeight: 720,
    backgroundColor: '#f5f7fb',
    title: 'OpenRabbit',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  const bundled = path.join(__dirname, 'workspace', 'index.html');
  const development = path.join(__dirname, '..', 'clients', 'real-estate-workspace', 'index.html');
  win.loadFile(fs.existsSync(bundled) ? bundled : development);
};

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
