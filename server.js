const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const session = require('express-session');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Session configuration
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Set to true if using HTTPS
}));

// Database setup
const db = new sqlite3.Database('./database.db');

// Create tables if not exist
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS speditions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS erfasser (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    datum TEXT,
    spedition_id INTEGER,
    lieferscheinnr TEXT,
    erhalten INTEGER,
    abgegeben INTEGER,
    notizen TEXT,
    erfasser TEXT,
    FOREIGN KEY (spedition_id) REFERENCES speditions(id)
  )`);
});

// Authentication middleware
function requireAuth(req, res, next) {
  if (req.session.authenticated) {
    return next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

// Routes
app.post('/login', (req, res) => {
  const { password } = req.body;
  if (password === 'admin') { // Replace with actual password
    req.session.authenticated = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

app.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// API routes
app.get('/api/speditions', requireAuth, (req, res) => {
  db.all('SELECT * FROM speditions', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

app.get('/api/erfasser', requireAuth, (req, res) => {
  db.all('SELECT * FROM erfasser', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

app.get('/api/entries', requireAuth, (req, res) => {
  db.all(`
    SELECT e.*, s.name as spedition_name
    FROM entries e
    LEFT JOIN speditions s ON e.spedition_id = s.id
    ORDER BY e.datum DESC
  `, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

app.post('/api/entries', requireAuth, (req, res) => {
  const { datum, spedition_id, lieferscheinnr, erhalten, abgegeben, notizen, erfasser } = req.body;
  db.run(`
    INSERT INTO entries (datum, spedition_id, lieferscheinnr, erhalten, abgegeben, notizen, erfasser)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [datum, spedition_id, lieferscheinnr, erhalten, abgegeben, notizen, erfasser], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json({ id: this.lastID });
    }
  });
});

app.put('/api/entries/:id', requireAuth, (req, res) => {
  const { datum, spedition_id, lieferscheinnr, erhalten, abgegeben, notizen, erfasser } = req.body;
  db.run(`
    UPDATE entries SET datum = ?, spedition_id = ?, lieferscheinnr = ?, erhalten = ?, abgegeben = ?, notizen = ?, erfasser = ?
    WHERE id = ?
  `, [datum, spedition_id, lieferscheinnr, erhalten, abgegeben, notizen, erfasser, req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json({ changes: this.changes });
    }
  });
});

app.post('/api/speditions', requireAuth, (req, res) => {
  const { name } = req.body;
  db.run('INSERT INTO speditions (name) VALUES (?)', [name], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json({ id: this.lastID });
    }
  });
});

app.delete('/api/speditions/:id', requireAuth, (req, res) => {
  db.run('DELETE FROM speditions WHERE id = ?', req.params.id, function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json({ changes: this.changes });
    }
  });
});

app.post('/api/erfasser', requireAuth, (req, res) => {
  const { name } = req.body;
  db.run('INSERT INTO erfasser (name) VALUES (?)', [name], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json({ id: this.lastID });
    }
  });
});

app.get('/api/export', requireAuth, (req, res) => {
  db.all('SELECT * FROM entries ORDER BY datum DESC', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="palettenerfassung_export.json"');
      res.send(JSON.stringify(rows, null, 2));
    }
  });
});

app.post('/api/import', requireAuth, (req, res) => {
  const entries = req.body;
  if (!Array.isArray(entries)) {
    return res.status(400).json({ error: 'Invalid data format' });
  }
  const stmt = db.prepare('INSERT OR REPLACE INTO entries (id, datum, spedition_id, lieferscheinnr, erhalten, abgegeben, notizen, erfasser) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  entries.forEach(entry => {
    stmt.run(entry.id, entry.datum, entry.spedition_id, entry.lieferscheinnr, entry.erhalten, entry.abgegeben, entry.notizen, entry.erfasser);
  });
  stmt.finalize();
  res.json({ success: true });
});

// Serve static files with auth check
app.use(express.static(path.join(__dirname, 'public')));

// Catch all handler: serve index.html for authenticated users, login.html for others
app.get('*', (req, res) => {
  if (req.session.authenticated) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});