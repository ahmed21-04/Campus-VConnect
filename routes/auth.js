const express = require('express');
const bcrypt = require('bcryptjs');
const { readDb, writeDb, freshId } = require('../db');
const { requireLogin } = require('../middleware/auth');

const router = express.Router();

function publicUser(u) {
  const { passwordHash, ...rest } = u;
  return rest;
}

router.post('/register', (req, res) => {
  const { name, email, password, role, departmentId, semesterNumber } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Name, email, password and role are required' });
  }
  if (!['student', 'teacher'].includes(role)) {
    return res.status(400).json({ error: 'Role must be student or teacher' });
  }
  const db = readDb();
  if (db.users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(409).json({ error: 'An account with that email already exists' });
  }
  const user = {
    id: freshId('user'),
    name,
    email,
    passwordHash: bcrypt.hashSync(password, 10),
    role,
    departmentId: departmentId || null,
    semesterNumber: role === 'student' ? (semesterNumber || 1) : null,
    profilePicture: null
  };
  db.users.push(user);
  writeDb(db);
  req.session.userId = user.id;
  req.session.role = user.role;
  res.json({ user: publicUser(user) });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  const db = readDb();
  const user = db.users.find(u => u.email.toLowerCase() === (email || '').toLowerCase());
  if (!user || !bcrypt.compareSync(password || '', user.passwordHash)) {
    return res.status(401).json({ error: 'Incorrect email or password' });
  }
  req.session.userId = user.id;
  req.session.role = user.role;
  res.json({ user: publicUser(user) });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get('/me', requireLogin, (req, res) => {
  const db = readDb();
  const user = db.users.find(u => u.id === req.session.userId);
  if (!user) return res.status(401).json({ error: 'Session invalid' });
  res.json({ user: publicUser(user) });
});

// Update own editable profile fields (name, phone, office). Role is NOT editable here.
router.put('/me', requireLogin, (req, res) => {
  const { name, phone, office } = req.body;
  const db = readDb();
  const user = db.users.find(u => u.id === req.session.userId);
  if (!user) return res.status(401).json({ error: 'Session invalid' });
  if (name != null && String(name).trim()) user.name = String(name).trim();
  if (phone != null) user.phone = String(phone);
  if (office != null) user.office = String(office);
  writeDb(db);
  res.json({ user: publicUser(user) });
});

router.put('/me/profile-picture', requireLogin, (req, res) => {
  const { profilePicture } = req.body;
  if (!profilePicture || typeof profilePicture !== 'string') {
    return res.status(400).json({ error: 'profilePicture (base64 data URL) is required' });
  }
  // Accept only data URLs so we don't store arbitrary content
  if (!profilePicture.startsWith('data:image/')) {
    return res.status(400).json({ error: 'profilePicture must be an image data URL' });
  }
  // No photo size restriction — the client compresses images automatically.
  const db = readDb();
  const user = db.users.find(u => u.id === req.session.userId);
  if (!user) return res.status(401).json({ error: 'Session invalid' });
  user.profilePicture = profilePicture;
  writeDb(db);
  res.json({ user: publicUser(user) });
});

module.exports = router;
