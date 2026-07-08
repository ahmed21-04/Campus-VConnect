const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const { ensureDb } = require('./db');

ensureDb();

const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(session({
  secret: 'campus-connect-dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 8 } // 8 hours
}));

app.use('/api/auth', require('./routes/auth'));
app.use('/api', require('./routes/academics'));
app.use('/api', require('./routes/records'));
app.use('/api', require('./routes/chat'));
app.use('/api', require('./routes/admin'));

app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`Campus Connect running at http://localhost:${PORT}`);
});
