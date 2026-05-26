# LocalSync

LocalSync è un'applicazione desktop per lo scambio rapido di file in locale tra il tuo computer e i dispositivi mobili (o altri PC) connessi alla stessa rete Wi-Fi o hotspot. 


## Caratteristiche

*   **Scambio File Locale**: Condivisione bidirezionale PC ⇄ Smartphone via Wi-Fi o Hotspot.
*   **Sicurezza**: Genera un token casuale a 16 caratteri all'avvio. La connessione è consentita solo ai client che presentano il token corretto (incluso automaticamente nel QR Code). Accesso negato per tutti gli altri utenti sulla stessa rete.
*   **Salvataggio**: I file inviati dal telefono vengono salvati in `Documenti/LocalSync` sul computer.
*   **Nessuna installazione mobile**: Il telefono si connette al server del PC tramite il browser web standard.

## Requisiti per lo Sviluppo

Per eseguire il codice in modalità di sviluppo è necessario avere installato **Node.js** sul computer.

> [!NOTE]
> Una volta compilata l'applicazione per la distribuzione (tramite il comando `package`), l'eseguibile risultante (es. `.exe`, `.dmg`, `.AppImage`) funzionerà su qualsiasi computer **anche senza Node.js installato**, poiché Electron include al suo interno l'ambiente necessario per l'esecuzione.

## Installazione e Avvio

1. Installa le dipendenze:
   ```bash
   npm install
   ```

2. Avvia in modalità di sviluppo:
   ```bash
   npm run dev
   ```

3. Compila e pacchettizza per la distribuzione:
   ```bash
   npm run package
   ```
