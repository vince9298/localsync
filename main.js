const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const express = require('express');
const multer = require('multer');
const cors = require('cors');

const crypto = require('crypto');

// App state
let mainWindow;
let localServer;
let sharedFiles = []; // Array of { id, name, path, size }
let saveDir = ''; // Will be initialized on app.ready using app.getPath
const securityToken = crypto.randomBytes(8).toString('hex'); // 16 random hex chars

// Generate a random unique ID
function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

// Network Interfaces helper
function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        // Exclude virtual adapter interfaces if possible to keep list clean,
        // but include them just in case.
        const isVirtual = name.toLowerCase().includes('virtual') || 
                          name.toLowerCase().includes('vbox') || 
                          name.toLowerCase().includes('vmware') ||
                          name.toLowerCase().includes('host-only');
        ips.push({
          name: name,
          address: net.address,
          isVirtual: isVirtual
        });
      }
    }
  }
  // Sort to put non-virtual interfaces first
  return ips.sort((a, b) => a.isVirtual - b.isVirtual);
}

// Start Express Server
function startHttpServer(port = 8080) {
  const expressApp = express();
  expressApp.use(cors());
  expressApp.use(express.json());
  
  // Middleware to verify token on incoming requests
  const verifyToken = (req, res, next) => {
    const token = req.query.token || req.headers['x-security-token'];
    if (token !== securityToken) {
      return res.status(403).send('Accesso negato: token di sicurezza non valido o mancante.');
    }
    next();
  };

  // Secure route for mobile.html
  expressApp.get('/mobile.html', verifyToken, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'mobile.html'));
  });
  
  // Serve the mobile page static folder (excluding mobile.html which is secured above)
  expressApp.use(express.static(path.join(__dirname, 'public')));

  // Configure Multer for File Uploads
  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, saveDir);
    },
    filename: function (req, file, cb) {
      const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8'); // support UTF-8 filenames
      const ext = path.extname(originalName);
      const base = path.basename(originalName, ext);
      let finalName = originalName;
      let counter = 1;
      while (fs.existsSync(path.join(saveDir, finalName))) {
        finalName = `${base}_${counter}${ext}`;
        counter++;
      }
      cb(null, finalName);
    }
  });
  const upload = multer({ storage: storage });

  // API: Get active shared files list (for the mobile client)
  expressApp.get('/api/files', verifyToken, (req, res) => {
    const list = sharedFiles.map(f => ({
      id: f.id,
      name: f.name,
      size: f.size
    }));
    res.json(list);
  });

  // API: Download a file from PC to Mobile
  expressApp.get('/api/download/:id', verifyToken, (req, res) => {
    const file = sharedFiles.find(f => f.id === req.params.id);
    if (!file || !fs.existsSync(file.path)) {
      return res.status(404).send('File non trovato');
    }
    res.download(file.path, file.name);
  });

  // API: Upload a file from Mobile to PC
  expressApp.post('/api/upload', verifyToken, upload.single('file'), (req, res) => {
    if (!req.file) {
      return res.status(400).send('Nessun file caricato');
    }
    
    const uploadedName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    const finalPath = req.file.path;
    const finalName = path.basename(finalPath);
    
    // Notify the renderer (React UI) that a file was received
    if (mainWindow) {
      mainWindow.webContents.send('file-received', {
        name: finalName,
        size: req.file.size,
        path: finalPath,
        time: new Date().toLocaleTimeString()
      });
    }

    res.status(200).json({ success: true, filename: finalName });
  });

  // Start listening
  localServer = expressApp.listen(port, '0.0.0.0', () => {
    console.log(`Web server running on port ${port}`);
    if (mainWindow) {
      mainWindow.webContents.send('server-status', { running: true, port: port });
    }
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} in use, trying ${port + 1}...`);
      startHttpServer(port + 1);
    } else {
      console.error('Server error:', err);
    }
  });
}

// Create Electron Window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 720,
    minWidth: 880,
    minHeight: 660,
    frame: false, // Frameless window for custom styling
    backgroundColor: '#050608',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // In development, load Vite dev server
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Electron App Lifecycle
app.whenReady().then(() => {
  // Initialize save path dynamically in user's Documents folder
  saveDir = path.join(app.getPath('documents'), 'LocalSync');
  if (!fs.existsSync(saveDir)) {
    fs.mkdirSync(saveDir, { recursive: true });
  }

  createWindow();
  startHttpServer();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handler: Get Server Information
ipcMain.handle('get-server-info', () => {
  const ips = getLocalIPs();
  const port = localServer ? localServer.address().port : 8080;
  return {
    ips: ips,
    port: port,
    saveDir: saveDir,
    token: securityToken
  };
});

// IPC Handler: Add Shared File from PC
ipcMain.handle('add-shared-file-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections']
  });

  if (result.canceled) return [];

  const added = [];
  for (const filePath of result.filePaths) {
    const name = path.basename(filePath);
    const stats = fs.statSync(filePath);
    
    // Check if already sharing this exact path
    if (sharedFiles.some(f => f.path === filePath)) continue;

    const fileObj = {
      id: generateId(),
      name: name,
      path: filePath,
      size: stats.size
    };
    sharedFiles.push(fileObj);
    added.push(fileObj);
  }
  
  // Notify client of updated shared list
  return sharedFiles;
});

// IPC Handler: Add Dropped Files (from drag and drop in renderer)
ipcMain.handle('add-dropped-files', (event, files) => {
  const added = [];
  for (const file of files) {
    if (!fs.existsSync(file.path)) continue;
    
    // Skip if already sharing
    if (sharedFiles.some(f => f.path === file.path)) continue;

    const fileObj = {
      id: generateId(),
      name: file.name,
      path: file.path,
      size: file.size
    };
    sharedFiles.push(fileObj);
    added.push(fileObj);
  }
  return sharedFiles;
});

// IPC Handler: Remove Shared File
ipcMain.handle('remove-shared-file', (event, id) => {
  sharedFiles = sharedFiles.filter(f => f.id !== id);
  return sharedFiles;
});

// IPC Handler: Get Shared Files List
ipcMain.handle('get-shared-files', () => {
  return sharedFiles;
});

// IPC Handler: Get Received Files from local Downloads/DropSync
ipcMain.handle('get-received-files', () => {
  try {
    const files = fs.readdirSync(saveDir);
    return files
      .map(file => {
        const filePath = path.join(saveDir, file);
        const stats = fs.statSync(filePath);
        if (stats.isDirectory()) return null;
        return {
          name: file,
          size: stats.size,
          path: filePath,
          time: stats.mtime.toLocaleTimeString(),
          mtime: stats.mtime
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.mtime - a.mtime); // Newest first
  } catch (err) {
    console.error('Error reading downloads directory:', err);
    return [];
  }
});

// IPC Handler: Open Downloads Directory
ipcMain.handle('open-downloads-folder', () => {
  shell.openPath(saveDir);
  return true;
});

// IPC Handler: Open specific received file
ipcMain.handle('open-received-file', (event, filePath) => {
  if (fs.existsSync(filePath)) {
    shell.openPath(filePath);
    return true;
  }
  return false;
});

// IPC Listeners: Window controls
ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});
ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});
ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});
