import { app, BrowserWindow } from 'electron';
import installExtension, { REACT_DEVELOPER_TOOLS } from 'electron-devtools-installer';
import { addBypassChecker, enableLiveReload } from 'electron-compile';
// usr imports
import fs from 'fs';
import os from 'os';
// usr vars
const homeDir = os.homedir();
const tempDir = homeDir.concat('/ardour_electron');

// bypass compiler for external mid file (important!)
addBypassChecker((filePath) => {
  return filePath.indexOf(app.getAppPath()) === -1;
});

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

const isDevMode = process.execPath.match(/[\\/]electron/);

if (isDevMode) enableLiveReload({ strategy: 'react-hmr' });

function createDir() {
  // Creates a temp folder, used to communicate with Ardour
  try {
    fs.mkdirSync(tempDir, { recursive: true });
  } catch (err) {
    console.log('error code: ', err.code);
    if (err.code === 'EEXIST') {
      console.error('Directory already exists');
    }
  }
}

function removeDir() {
  // Remove temp folder, but first delete files in folder
  if (fs.existsSync(tempDir)) {
    fs.readdirSync(tempDir).forEach((file) => {
      const curPath = tempDir.concat('/', file);
      fs.unlinkSync(curPath);
    });
    fs.rmdirSync(tempDir);
  }
}

const createWindow = async () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
  });

  // and load the index.html of the app.
  mainWindow.loadURL(`file://${__dirname}/index.html`);

  // Open the DevTools.
  if (isDevMode) {
    await installExtension(REACT_DEVELOPER_TOOLS);
    mainWindow.webContents.openDevTools();
  }

  // create tmp folder
  createDir();

  // Emitted when the window is closed.
  mainWindow.on('closed', () => {
    // remove tmp folder
    removeDir();
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
