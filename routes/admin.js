const express = require('express');
const bcrypt = require('bcryptjs');
const { readDb, writeDb, freshId } = require('../db');
const { requireLogin, requireRole } = require('../middleware/auth');

const router = express.Router();

function publicUser(u) {
  const { passwordHash, ...rest } = u;
  return rest;
}

// ---------- User directory (admin) ----------
// List users, optionally filtered by role (?role=student|teacher|admin)
router.get('/users', requireLogin, requireRole('admin'), (req, res) => {
  const db = readDb();
  let users = db.users;
  if (req.query.role) users = users.filter(u => u.role === req.query.role);
  res.json({ users: users.map(publicUser) });
});

// Admin creates a student or teacher (admin sets the initial password)
router.post('/users', requireLogin, requireRole('admin'), (req, res) => {
  const { name, email, password, role, departmentId, semesterNumber, phone, teaches } = req.body;
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
    semesterNumber: role === 'student' ? (Number(semesterNumber) || 1) : null,
    teaches: role === 'teacher' ? (teaches || '') : undefined,
    phone: phone || '',
    office: '',
    profilePicture: null
  };
  db.users.push(user);
  writeDb(db);
  res.json({ user: publicUser(user) });
});

// Admin edits a user's details (not their own role)
router.put('/users/:id', requireLogin, requireRole('admin'), (req, res) => {
  const { name, email, departmentId, semesterNumber, phone, teaches, password } = req.body;
  const db = readDb();
  const user = db.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (name != null && String(name).trim()) user.name = String(name).trim();
  if (email != null && String(email).trim()) {
    const clash = db.users.find(u => u.id !== user.id && u.email.toLowerCase() === email.toLowerCase());
    if (clash) return res.status(409).json({ error: 'Another account already uses that email' });
    user.email = String(email).trim();
  }
  if (departmentId !== undefined) user.departmentId = departmentId || null;
  if (semesterNumber != null && user.role === 'student') user.semesterNumber = Number(semesterNumber) || user.semesterNumber;
  if (phone != null) user.phone = String(phone);
  if (teaches != null && user.role === 'teacher') user.teaches = String(teaches);
  if (password) user.passwordHash = bcrypt.hashSync(password, 10);
  writeDb(db);
  res.json({ user: publicUser(user) });
});

// Admin deletes a user (cannot delete self or another admin)
router.delete('/users/:id', requireLogin, requireRole('admin'), (req, res) => {
  const db = readDb();
  const user = db.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.id === req.session.userId) return res.status(400).json({ error: 'You cannot delete your own account' });
  if (user.role === 'admin') return res.status(400).json({ error: 'Admin accounts cannot be deleted here' });
  db.users = db.users.filter(u => u.id !== user.id);
  writeDb(db);
  res.json({ ok: true });
});

// ---------- Teacher / professor directory (any logged-in user) ----------
router.get('/teachers', requireLogin, (req, res) => {
  const db = readDb();
  const teachers = db.users.filter(u => u.role === 'teacher').map(t => {
    const dept = db.departments.find(d => d.id === t.departmentId);
    return { ...publicUser(t), departmentName: dept ? dept.name : null };
  });
  res.json({ teachers });
});

// ---------- Administrator contact (for footer on home/login pages) ----------
// Public: the login page shows this before a session exists
router.get('/contact', (req, res) => {
  const db = readDb();
  const admin = db.users.find(u => u.role === 'admin');
  if (!admin) return res.json({ contact: null });
  res.json({ contact: { name: admin.name, email: admin.email, phone: admin.phone || '', office: admin.office || '' } });
});

module.exports = router;
