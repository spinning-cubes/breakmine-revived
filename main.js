const { app, BrowserWindow } = require('electron');
const path = require('node:path');

const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';
app.commandLine.appendSwitch('disable-pointer-lock-options');

function createWindow() {
  const iconFileName = process.platform === 'linux' ? 'favicon.png' : 'favicon.png';
  const iconPath = path.join(__dirname, 'src/resources', iconFileName);

  const win = new BrowserWindow({
    width: 1024,
    height: 768,
    autoHideMenuBar: true,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown') {
      // Toggle DevTools (F12)
      if (input.key === 'F12') {
        win.webContents.toggleDevTools();
        event.preventDefault();
      }

      // Toggle Fullscreen (F11)
      if (input.key === 'F11') {
        win.setFullScreen(!win.isFullScreen());
        event.preventDefault();
      }
      
      // Reload page (Ctrl+R or Cmd+R)
      if ((input.control || input.meta) && input.key.toLowerCase() === 'r') {
        if (input.shift) {
          win.webContents.reloadIgnoringCache(); // Ctrl+Shift+R
        } else {
          win.webContents.reload(); // Ctrl+R
        }
        event.preventDefault();
      }
    }
  });

  win.setMenu(null);

  if (isDev) {
    // Load Vite dev server URL
    win.loadURL('http://localhost:8000');
    // win.webContents.openDevTools(); // Uncomment if you want DevTools on launch
  } else {
    // Load built static assets in production
    win.loadFile(path.join(__dirname, 'dist/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});