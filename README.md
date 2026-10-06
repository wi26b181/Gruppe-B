# Interaktives Quiz (Gruppe B)

Mehrspieler-Quiz mit Node.js, Express und Socket.IO.

## Starten in Visual Studio Code

1. Den Projektordner in VS Code öffnen (**Datei → Ordner öffnen…**).
2. Terminal öffnen (**Terminal → Neues Terminal**) und einmalig die Pakete installieren:
   ```
   npm install
   ```
3. Server starten:
   ```
   npm start
   ```
   (oder einfach **F5** drücken → „Quiz-Server starten“)
4. Im Browser **http://localhost:3000** öffnen.

> Wichtig: Die `index.html` **nicht** per Doppelklick oder mit „Live Server“ öffnen.
> Das Quiz braucht den Node-Server, sonst bleibt es beim Startbildschirm hängen.

## Mit mehreren Spielern testen

- Am selben Computer: einen zweiten Browser-Tab (oder ein privates Fenster) mit
  http://localhost:3000 öffnen und mit dem Spielcode beitreten.
- Mit dem Handy: Handy und Computer müssen im selben WLAN sein. Den QR-Code im
  Warteraum scannen. Falls das nicht klappt, die Windows-Firewall für Node.js erlauben.

## Projektstruktur

| Datei | Inhalt |
|---|---|
| `server.js` | Server, Spiellogik, Räume, Punkte |
| `readData.js` | liest die Fragen aus `quizData.json` |
| `quizData.json` | Fragen (`correct` = Index der richtigen Antwort, beginnt bei 0) |
| `public/index.html` | Webseite inkl. Client-Code |
| `public/client.js` | wird aktuell **nicht** verwendet (gehört zu einer anderen HTML-Version) |
