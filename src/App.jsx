import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import './App.css';

// Translation Dictionary
const t = {
  it: {
    subtitle: "Scambia file in locale alla velocità del Wi-Fi",
    folderBtn: "📁 Cartella LocalSync",
    connectTitle: "Connetti Dispositivo",
    activeNetwork: "Rete Attiva:",
    qrScan: "Scansiona QR per connetterti",
    portalUrl: "URL del Portale:",
    copyTooltip: "Clicca per copiare",
    shareTitle: "Condividi con Dispositivo",
    dragZoneText: "Trascina file qui o sfoglia",
    dragZoneSubtext: "Saranno scaricabili dal telefono",
    sharedTitle: "In Condivisione",
    emptyShared: "Nessun file condiviso.",
    emptySharedSub: "Trascina qui i file per inviarli al telefono",
    receivedTitle: "Ricevuti dal Telefono",
    emptyReceived: "Ancora nessun file ricevuto.",
    emptyReceivedSub: "Carica un file dal portale mobile per vederlo apparire qui",
    openFile: "Apri File",
    toastCopied: "URL Copiato negli appunti!",
    dragOverlay: "Rilascia per condividere con il telefono",
    notificationTitle: "LocalSync",
    notificationBody: "Ricevuto: {name} ({size})",
    langToggle: "🇬🇧 English"
  },
  en: {
    subtitle: "Share files locally at Wi-Fi speed",
    folderBtn: "📁 LocalSync Folder",
    connectTitle: "Connect Device",
    activeNetwork: "Active Network:",
    qrScan: "Scan QR to connect",
    portalUrl: "Portal URL:",
    copyTooltip: "Click to copy",
    shareTitle: "Share with Device",
    dragZoneText: "Drag files here or browse",
    dragZoneSubtext: "They will be downloadable from your phone",
    sharedTitle: "Shared Files",
    emptyShared: "No files shared.",
    emptySharedSub: "Drag files here to send them to your phone",
    receivedTitle: "Received from Phone",
    emptyReceived: "No files received yet.",
    emptyReceivedSub: "Upload a file from the mobile portal to see it here",
    openFile: "Open File",
    toastCopied: "URL Copied to clipboard!",
    dragOverlay: "Release to share with phone",
    notificationTitle: "LocalSync",
    notificationBody: "Received: {name} ({size})",
    langToggle: "🇮🇹 Italiano"
  }
};

export default function App() {
  const [ips, setIps] = useState([]);
  const [selectedIp, setSelectedIp] = useState('');
  const [port, setPort] = useState(8080);
  const [saveDir, setSaveDir] = useState('');
  const [token, setToken] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [lang, setLang] = useState(() => localStorage.getItem('localSync_lang') || 'it');
  
  const [sharedFiles, setSharedFiles] = useState([]);
  const [receivedFiles, setReceivedFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);

  // Load server info and initial lists
  useEffect(() => {
    // 1. Get network interfaces and paths
    window.electron.invoke('get-server-info').then((info) => {
      setIps(info.ips);
      setPort(info.port);
      setSaveDir(info.saveDir);
      setToken(info.token);
      
      // Select the first non-virtual IP by default
      const defaultIp = info.ips.length > 0 ? info.ips[0].address : '127.0.0.1';
      setSelectedIp(defaultIp);
    });

    // 2. Get shared files
    window.electron.invoke('get-shared-files').then((files) => {
      setSharedFiles(files);
    });

    // 3. Get received files
    refreshReceivedFiles();

    // 4. Listen to backend upload notifications
    const unsubscribe = window.electron.on('file-received', (newFile) => {
      // Add to received state immediately and refresh directory listing
      setReceivedFiles(prev => [newFile, ...prev]);
      
      // OS level notification
      const bodyText = t[lang].notificationBody
        .replace('{name}', newFile.name)
        .replace('{size}', formatBytes(newFile.size));
        
      new Notification(t[lang].notificationTitle, {
        body: bodyText,
        silent: false
      });
    });

    return () => {
      unsubscribe();
    };
  }, [lang]);

  // Update server URL when IP, port or token changes
  useEffect(() => {
    if (selectedIp && token) {
      const url = `http://${selectedIp}:${port}/mobile.html?token=${token}`;
      setServerUrl(url);
    }
  }, [selectedIp, port, token]);

  // Generate QR Code when URL changes
  useEffect(() => {
    if (serverUrl) {
      QRCode.toDataURL(serverUrl, {
        margin: 2,
        scale: 6,
        color: {
          dark: '#0f172a',
          light: '#f8fafc'
        }
      })
        .then(url => setQrCodeDataUrl(url))
        .catch(err => console.error('Errore generazione QR:', err));
    }
  }, [serverUrl]);

  // Refresh received files from Downloads folder
  const refreshReceivedFiles = () => {
    window.electron.invoke('get-received-files').then((files) => {
      setReceivedFiles(files);
    });
  };

  // Select files to share using OS dialogue
  const handleSelectFiles = () => {
    window.electron.invoke('add-shared-file-dialog').then((updatedList) => {
      setSharedFiles(updatedList);
    });
  };

  // Remove file from shared list
  const handleRemoveShared = (id) => {
    window.electron.invoke('remove-shared-file', id).then((updatedList) => {
      setSharedFiles(updatedList);
    });
  };

  // Open Downloads folder in OS Explorer/Finder
  const handleOpenDownloads = () => {
    window.electron.invoke('open-downloads-folder');
  };

  // Open received file in OS default application
  const handleOpenReceivedFile = (path) => {
    window.electron.invoke('open-received-file', path);
  };

  // Copy server URL and trigger toast
  const handleCopyUrl = () => {
    navigator.clipboard.writeText(serverUrl);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  };

  // Toggle Language
  const toggleLanguage = () => {
    const newLang = lang === 'it' ? 'en' : 'it';
    setLang(newLang);
    localStorage.setItem('localSync_lang', newLang);
  };

  // Drag and Drop files handling
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const filesArray = Array.from(e.dataTransfer.files).map(file => ({
        name: file.name,
        path: file.path,
        size: file.size
      }));

      window.electron.invoke('add-dropped-files', filesArray).then((updatedList) => {
        setSharedFiles(updatedList);
      });
    }
  };

  // Helper size formatter
  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // File type icon resolver
  const getFileIcon = (fileName) => {
    const ext = fileName.split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'heic'].includes(ext)) return '🖼️';
    if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) return '🎥';
    if (['mp3', 'wav', 'flac', 'ogg', 'm4a'].includes(ext)) return '🎵';
    if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md', 'csv'].includes(ext)) return '📄';
    if (['zip', 'rar', 'tar', 'gz', '7z'].includes(ext)) return '📦';
    return '📁';
  };

  return (
    <div className="app-container" onDragEnter={handleDrag}>
      {/* Custom Frameless Title Bar */}
      <div className="custom-title-bar">
        <div className="title-bar-drag-area">
          <span className="title-bar-logo">⇄</span>
          <span className="title-bar-text">LocalSync</span>
        </div>
        <div className="title-bar-controls">
          <button className="control-btn minimize-btn" onClick={() => window.electron.send('window-minimize')} title={lang === 'it' ? 'Riduci a icona' : 'Minimize'}>⎯</button>
          <button className="control-btn maximize-btn" onClick={() => window.electron.send('window-maximize')} title={lang === 'it' ? 'Ingrandisci' : 'Maximize'}>❑</button>
          <button className="control-btn close-btn" onClick={() => window.electron.send('window-close')} title={lang === 'it' ? 'Chiudi' : 'Close'}>✕</button>
        </div>
      </div>

      {/* Background glow animations */}
      <div className="bg-glow bg-glow-primary"></div>
      <div className="bg-glow bg-glow-secondary"></div>

      <header className="app-header">
        <div className="header-left">
          <div className="brand-logo">⇄</div>
          <div className="brand-info">
            <h1>LocalSync</h1>
            <p className="subtitle">{t[lang].subtitle}</p>
          </div>
        </div>
        <div className="header-right">
          <button className="btn btn-secondary" onClick={handleOpenDownloads}>
            {t[lang].folderBtn}
          </button>
        </div>
      </header>

      <main className="app-main">
        {/* Connection details panel */}
        <section className="app-panel panel-connection">
          <h2 className="panel-title">
            <span className="pulse-dot pulse-dot-green"></span> {t[lang].connectTitle}
          </h2>
          
          <div className="form-group">
            <label htmlFor="ip-select">{t[lang].activeNetwork}</label>
            <select
              id="ip-select"
              value={selectedIp}
              onChange={(e) => setSelectedIp(e.target.value)}
              className="ip-select-dropdown"
            >
              {ips.map((ip) => (
                <option key={ip.address} value={ip.address}>
                  {ip.name} • {ip.address} {ip.isVirtual ? '(Virtuale)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="qr-container">
            {qrCodeDataUrl ? (
              <div className="qr-card">
                <img src={qrCodeDataUrl} alt="QR Code" className="qr-image" />
                <div className="qr-overlay-text">{t[lang].qrScan}</div>
              </div>
            ) : (
              <div className="qr-placeholder">Generazione QR...</div>
            )}
          </div>

          <div className="connection-info">
            <span className="info-label">{t[lang].portalUrl}</span>
            <div className="info-value" onClick={handleCopyUrl} title={t[lang].copyTooltip}>
              <span>{serverUrl}</span>
              <span className="copy-hint">📋</span>
            </div>
          </div>
        </section>

        {/* Share files section */}
        <section className="app-panel panel-share">
          <h2 className="panel-title">
            <span className="pulse-dot pulse-dot-indigo"></span> {t[lang].shareTitle}
          </h2>

          <div
            className={`drop-zone ${dragActive ? 'active' : ''}`}
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={handleSelectFiles}
          >
            <div className="drop-zone-content">
              <span className="drop-icon">➕</span>
              <span className="drop-text">{t[lang].dragZoneText}</span>
              <span className="drop-subtext">{t[lang].dragZoneSubtext}</span>
            </div>
          </div>

          <div className="shared-list-container">
            <h3>{t[lang].sharedTitle} ({sharedFiles.length})</h3>
            {sharedFiles.length === 0 ? (
              <div className="panel-empty-state">
                <span className="empty-emoji">📤</span>
                <p>{t[lang].emptyShared}</p>
                <p className="empty-sub">{t[lang].emptySharedSub}</p>
              </div>
            ) : (
              <div className="shared-list">
                {sharedFiles.map(file => (
                  <div key={file.id} className="file-item share-item">
                    <div className="file-info">
                      <span className="file-name" title={file.name}>
                        {getFileIcon(file.name)} {file.name}
                      </span>
                      <span className="file-size">{formatBytes(file.size)}</span>
                    </div>
                    <button
                      className="btn-action btn-delete"
                      onClick={() => handleRemoveShared(file.id)}
                      title={lang === 'it' ? 'Interrompi condivisione' : 'Stop sharing'}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Received files section */}
        <section className="app-panel panel-received">
          <div className="panel-header-row">
            <h2 className="panel-title">
              <span className="pulse-dot pulse-dot-violet"></span> {t[lang].receivedTitle}
            </h2>
            <button className="btn-icon-refresh" onClick={refreshReceivedFiles} title={lang === 'it' ? 'Aggiorna lista' : 'Refresh list'}>
              🔄
            </button>
          </div>

          <div className="received-list-container">
            {receivedFiles.length === 0 ? (
              <div className="panel-empty-state">
                <span className="empty-emoji">📱</span>
                <p>{t[lang].emptyReceived}</p>
                <p className="empty-sub">{t[lang].emptyReceivedSub}</p>
              </div>
            ) : (
              <div className="received-list">
                {receivedFiles.map((file, idx) => (
                  <div key={idx} className="file-item received-item" onClick={() => handleOpenReceivedFile(file.path)}>
                    <div className="file-info">
                      <span className="file-name" title={file.name}>
                        {getFileIcon(file.name)} {file.name}
                      </span>
                      <div className="file-meta">
                        <span>{formatBytes(file.size)}</span>
                        <span className="meta-separator">•</span>
                        <span>{file.time}</span>
                      </div>
                    </div>
                    <span className="btn-action-open" title={t[lang].openFile}>
                      👁️
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Language Switcher Footer */}
      <footer className="app-footer-bar">
        <button className="btn-lang-toggle" onClick={toggleLanguage}>
          {t[lang].langToggle}
        </button>
      </footer>

      {/* Full screen Drag Overlay */}
      {dragActive && (
        <div
          className="global-drag-overlay"
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
        >
          <div className="overlay-box">
            <span className="overlay-icon">📥</span>
            <span className="overlay-text">{t[lang].dragOverlay}</span>
          </div>
        </div>
      )}

      {/* Copy feedback Toast */}
      {showToast && (
        <div className="toast-notification">
          {t[lang].toastCopied}
        </div>
      )}
    </div>
  );
}
