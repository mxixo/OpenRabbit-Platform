const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('openRabbitDesktop', {
  platform: process.platform,
  desktop: true,
  version: '0.1.0'
});
