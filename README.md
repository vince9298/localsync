# LocalSync ⇄

LocalSync è un'applicazione desktop (Windows, macOS, Linux) offline-first per lo scambio rapido e sicuro di file in locale tra il tuo PC e i dispositivi mobili (smartphone, tablet) o altri computer connessi alla stessa rete Wi-Fi o hotspot. 

L'applicazione funziona interamente sul tuo hardware, **senza necessità di connessione internet e senza appoggiare i tuoi dati su server cloud esterni**, garantendo una privacy assoluta e velocità di trasferimento elevate.

---

## ⚡ Caratteristiche Principali

*   **Scambio Bidirezionale Intelligente**:
    *   **PC ➔ Telefono**: Trascina un file nella dashboard desktop e scaricalo istantaneamente sul telefono tramite il portale mobile.
    *   **Telefono ➔ PC**: Scansiona il QR code, seleziona una foto o un documento dal tuo smartphone e invialo direttamente alla cartella dedicata sul PC.
*   **Sicurezza Avanzata (Token di Sicurezza)**: All'avvio dell'applicazione sul PC viene generata una chiave crittografica casuale a 16 caratteri. Qualsiasi dispositivo sulla stessa rete locale che tenta di connettersi senza presentare il token (che è incorporato nel QR Code) riceverà un errore `403 Accesso Negato`. Questo blinda l'applicazione anche quando viene utilizzata su Wi-Fi pubbliche (università, uffici, bar).
*   **Zero Installazioni sui Dispositivi Mobili**: Il dispositivo mobile si connette all'applicazione tramite il browser web integrato (Safari, Chrome, ecc.) dopo aver scansionato il QR Code.
*   **Archiviazione Ordinata**: I file ricevuti dal telefono vengono archiviati automaticamente nella cartella di sistema `Documenti/LocalSync` sul PC.
*   **Interfaccia Premium & Animata**: Design scuro con card in vetro sfocato (glassmorphism), indicatori di stato pulsanti in tempo reale e animazioni di slittamento ed ellissi dei nomi dei file in caso di testi lunghi.

---

## 🛠️ Tecnologie Utilizzate

*   **Desktop App**: [Electron](https://www.electronjs.org/) (Main Process in Node.js, Renderer Process in React)
*   **Frontend Desktop**: [React](https://react.dev/) + [Vite](https://vite.dev/) (Stile con CSS Modules)
*   **Local Web Server**: [Express](https://expressjs.com/) + [Multer](https://github.com/expressjs/multer) (per la gestione dello streaming e dell'upload multipart)
*   **Mobile Portal**: HTML5, CSS3, Vanilla JS (sfrutta `XMLHttpRequest` per il tracciamento in tempo reale della barra di avanzamento dell'upload)
*   **Generazione QR**: [node-qrcode](https://github.com/soldair/node-qrcode)

---

## 🚀 Guida all'Installazione e Sviluppo

Assicurati di avere [Node.js](https://nodejs.org/) (versione 18 o superiore) installato sul tuo sistema.

### 1. Clona o crea il progetto ed entra nella directory
```bash
cd dropsync
```

### 2. Installa le dipendenze
```bash
npm install
```

### 3. Avvia in modalità di sviluppo (Development Mode)
Questo comando avvia contemporaneamente il server di sviluppo di Vite per il frontend React e l'istanza desktop di Electron.
```bash
npm run dev
```

### 4. Compila e Pacchettizza l'App per la Distribuzione (Build & Package)
Per generare l'eseguibile nativo installabile per il tuo sistema operativo (es. `.exe` per Windows, `.dmg`/`.app` per macOS, `.deb`/`.AppImage` per Linux):
```bash
npm run package
```

---

## 📦 Come Funziona il Trasferimento dei File?

*   **Ricezione (Telefono ➔ PC)**:
    Il server Express riceve il file tramite chiamata HTTP POST, rimuove eventuali caratteri dannosi dal nome del file (protezione da directory traversal), risolve i conflitti di nome duplicato (rinominandoli in `nome_1.ext`, `nome_2.ext`) e notifica l'app desktop tramite il canale IPC nativo di Electron per aggiornare istantaneamente la lista senza ricaricare la pagina.
*   **Condivisione (PC ➔ Telefono)**:
    Quando trascini un file nella dashboard, l'app ne memorizza solo il percorso assoluto in memoria. Quando il browser del telefono richiede il download, il server Express legge e invia il file come stream binario direttamente dalla sua posizione originale, **evitando inutili duplicazioni o copie di file sul PC**.
