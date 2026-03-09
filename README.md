# Palettenerfassung App

Eine Node.js-basierte Webanwendung zur Verwaltung von Palettenbeständen mit Authentifizierung, Einstellungen und Im-/Export-Funktionalität.

## Funktionen

- 🔐 Passwort-geschützte Anmeldung
- 📊 Eintragsmanagement (Lieferschein, Paletten Ein/Aus)
- ⚙️ Speditionen und Erfasser verwalten
- 💾 Daten im- und exportieren (JSON)
- 📱 Responsive Bootstrap UI

## Installation lokal

1. **Abhängigkeiten installieren:**
   ```bash
   npm install
   ```

2. **.env Datei erstellen** (basierend auf .env.example):
   ```bash
   cp .env.example .env
   ```

3. **Für lokale Entwicklung mit PostgreSQL:**
   - PostgreSQL installieren und starten
   - Datenbank erstellen: `createdb palettenerfassung`
   - DATABASE_URL in .env eintragen:
     ```
     DATABASE_URL=postgresql://user:password@localhost:5432/palettenerfassung
     ```

4. **Server starten:**
   ```bash
   npm start
   ```

5. **Zugreifen:**
   - http://localhost:3000
   - Passwort: `admin` (oder in .env `APP_PASSWORD` ändern)

## Deployment auf OnRender

### PostgreSQL-Datenbank erstellen

1. Gehe zu [OnRender.com](https://onrender.com)
2. Klicke auf **"New +"** → **"PostgreSQL"**
3. Wähle den kostenlosen Plan
4. Notiere die Verbindungsdetails

### App deployen

1. GitHub Repo synchronisieren mit den aktualisierten Dateien
2. In OnRender: **"New +"** → **"Web Service"**
3. Mit GitHub verbinden
4. Konfigurieren:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Umgebungsvariablen setzen:
   ```
   DATABASE_URL=postgresql://...  (von PostgreSQL-Service kopieren)
   SESSION_SECRET=your-secure-random-key
   APP_PASSWORD=your-password
   NODE_ENV=production
   ```
6. Deployen

## Umgebungsvariablen

| Variable | Beschreibung | Standard |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL Verbindungsstring | (erforderlich) |
| `SESSION_SECRET` | Session-Verschlüsselungsschlüssel | `your-secret-key` |
| `APP_PASSWORD` | Passwort für App-Zugriff | `admin` |
| `NODE_ENV` | Umgebung (development/production) | `development` |
| `PORT` | Server-Port | `3000` |

## API-Endpoints

Alle Endpoints erfordern Authentifizierung (`/api/entries`, `/api/speditions`, `/api/erfasser`).

- `POST /login` - Anmelden
- `POST /logout` - Abmelden
- `GET /api/entries` - Alle Einträge
- `POST /api/entries` - Neuen Eintrag erstellen
- `GET /api/entries/:id` - Eintrag abrufen
- `PUT /api/entries/:id` - Eintrag aktualisieren
- `DELETE /api/entries/:id` - Eintrag löschen
- `GET /api/speditions`, `POST /api/speditions`, `DELETE /api/speditions/:id`
- `GET /api/erfasser`, `POST /api/erfasser`, `DELETE /api/erfasser/:id`
- `GET /api/export` - Alle Einträge als JSON exportieren
- `POST /api/import` - Einträge aus JSON importieren

## Tech Stack

- **Backend:** Node.js, Express.js
- **Datenbank:** PostgreSQL
- **Frontend:** HTML, Bootstrap 5, Vanilla JavaScript
- **Session:** express-session

## Lizenz

MIT