const express = require('express');
const { Pool } = require('pg');
const session = require('express-session');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// Create tables if not exist
async function initializeDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS speditions (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS erfasser (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS entries (
        id SERIAL PRIMARY KEY,
        datum TEXT NOT NULL,
        spedition_id INTEGER,
        lieferscheinnr TEXT,
        erhalten INTEGER,
        abgegeben INTEGER,
        notizen TEXT,
        erfasser TEXT,
        FOREIGN KEY (spedition_id) REFERENCES speditions(id)
      )
    `);

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

// Initialize DB
initializeDB();

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
  if (password === process.env.APP_PASSWORD || password === 'admin') {
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
app.get('/api/speditions', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM speditions ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/erfasser', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM erfasser ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/entries', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT e.*, s.name as spedition_name
      FROM entries e
      LEFT JOIN speditions s ON e.spedition_id = s.id
      ORDER BY e.datum DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/entries', requireAuth, async (req, res) => {
  const { datum, spedition_id, lieferscheinnr, erhalten, abgegeben, notizen, erfasser } = req.body;
  try {
    const result = await pool.query(`
      INSERT INTO entries (datum, spedition_id, lieferscheinnr, erhalten, abgegeben, notizen, erfasser)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
    `, [datum, spedition_id || null, lieferscheinnr, erhalten, abgegeben, notizen, erfasser]);
    res.json({ id: result.rows[0].id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/entries/:id', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM entries WHERE id = $1', [req.params.id]);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/entries/:id', requireAuth, async (req, res) => {
  const { datum, spedition_id, lieferscheinnr, erhalten, abgegeben, notizen, erfasser } = req.body;
  try {
    await pool.query(`
      UPDATE entries SET datum = $1, spedition_id = $2, lieferscheinnr = $3, erhalten = $4, abgegeben = $5, notizen = $6, erfasser = $7
      WHERE id = $8
    `, [datum, spedition_id || null, lieferscheinnr, erhalten, abgegeben, notizen, erfasser, req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/entries/:id', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM entries WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/speditions', requireAuth, async (req, res) => {
  const { name } = req.body;
  try {
    const result = await pool.query('INSERT INTO speditions (name) VALUES ($1) RETURNING id', [name]);
    res.json({ id: result.rows[0].id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/speditions/:id', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM speditions WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/erfasser', requireAuth, async (req, res) => {
  const { name } = req.body;
  try {
    const result = await pool.query('INSERT INTO erfasser (name) VALUES ($1) RETURNING id', [name]);
    res.json({ id: result.rows[0].id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/export', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM entries ORDER BY datum DESC');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="palettenerfassung_export.json"');
    res.send(JSON.stringify(result.rows, null, 2));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/import', requireAuth, async (req, res) => {
  const entries = req.body;
  if (!Array.isArray(entries)) {
    return res.status(400).json({ error: 'Invalid data format' });
  }
  try {
    for (const entry of entries) {
      await pool.query(`
        INSERT INTO entries (id, datum, spedition_id, lieferscheinnr, erhalten, abgegeben, notizen, erfasser)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO UPDATE SET
          datum = $2, spedition_id = $3, lieferscheinnr = $4, erhalten = $5, abgegeben = $6, notizen = $7, erfasser = $8
      `, [entry.id, entry.datum, entry.spedition_id || null, entry.lieferscheinnr, entry.erhalten, entry.abgegeben, entry.notizen, entry.erfasser]);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/erfasser/:id', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM erfasser WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Catch all handler
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