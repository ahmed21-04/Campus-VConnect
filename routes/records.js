const express = require('express');
const { readDb, writeDb, freshId } = require('../db');
const { requireLogin, requireRole } = require('../middleware/auth');

const router = express.Router();

function publicUser(u) {
  const { passwordHash, ...rest } = u;
  return rest;
}

// List students (optionally filtered by department) - for teachers/admin to pick from
router.get('/students', requireLogin, requireRole('teacher', 'admin'), (req, res) => {
  const db = readDb();
  let students = db.users.filter(u => u.role === 'student');
  if (req.query.departmentId) students = students.filter(s => s.departmentId === req.query.departmentId);
  res.json({ students: students.map(publicUser) });
});

// ---------- Attendance ----------
router.get('/attendance', requireLogin, (req, res) => {
  const db = readDb();
  const studentId = req.session.role === 'student' ? req.session.userId : req.query.studentId;
  if (!studentId) return res.json({ attendance: [] });
  const records = db.attendance.filter(a => a.studentId === studentId);
  res.json({ attendance: records });
});

router.post('/attendance', requireLogin, requireRole('teacher', 'admin'), (req, res) => {
  const { subjectId, studentId, date, status } = req.body;
  if (!subjectId || !studentId || !date || !status) {
    return res.status(400).json({ error: 'subjectId, studentId, date and status are required' });
  }
  const db = readDb();
  // Upsert: if already marked for this student/subject/date, update instead of duplicating
  const existing = db.attendance.find(a => a.subjectId === subjectId && a.studentId === studentId && a.date === date);
  if (existing) {
    existing.status = status;
    writeDb(db);
    return res.json({ ok: true, updated: true });
  }
  db.attendance.push({ id: freshId('att'), subjectId, studentId, date, status });
  writeDb(db);
  res.json({ ok: true });
});

// Correct a mistakenly marked attendance record
router.put('/attendance/:id', requireLogin, requireRole('teacher', 'admin'), (req, res) => {
  const { status, date } = req.body;
  const db = readDb();
  const rec = db.attendance.find(a => a.id === req.params.id);
  if (!rec) return res.status(404).json({ error: 'Attendance record not found' });
  if (status && ['present', 'absent'].includes(status)) rec.status = status;
  if (date) rec.date = date;
  writeDb(db);
  res.json({ record: rec });
});

// Remove a wrongly added attendance record
router.delete('/attendance/:id', requireLogin, requireRole('teacher', 'admin'), (req, res) => {
  const db = readDb();
  const before = db.attendance.length;
  db.attendance = db.attendance.filter(a => a.id !== req.params.id);
  if (db.attendance.length === before) return res.status(404).json({ error: 'Attendance record not found' });
  writeDb(db);
  res.json({ ok: true });
});

// ---------- Academic performance ----------
router.get('/performance', requireLogin, (req, res) => {
  const db = readDb();
  const studentId = req.session.role === 'student' ? req.session.userId : req.query.studentId;
  if (!studentId) return res.json({ performance: [] });
  res.json({ performance: db.performance.filter(p => p.studentId === studentId) });
});

router.post('/performance', requireLogin, requireRole('teacher', 'admin'), (req, res) => {
  const { studentId, subjectId, examType, marks, maxMarks } = req.body;
  if (!studentId || !subjectId || !examType || marks == null || !maxMarks) {
    return res.status(400).json({ error: 'studentId, subjectId, examType, marks and maxMarks are required' });
  }
  const db = readDb();
  db.performance.push({ id: freshId('perf'), studentId, subjectId, examType, marks, maxMarks });
  writeDb(db);
  res.json({ ok: true });
});

// ---------- Cultural performance / achievements ----------
router.get('/culturals', requireLogin, (req, res) => {
  const db = readDb();
  const studentId = req.session.role === 'student' ? req.session.userId : req.query.studentId;
  if (!studentId) return res.json({ culturals: db.culturals });
  res.json({ culturals: db.culturals.filter(c => c.studentId === studentId) });
});

router.post('/culturals', requireLogin, requireRole('teacher', 'admin'), (req, res) => {
  const { studentId, title, description, date } = req.body;
  if (!studentId || !title) return res.status(400).json({ error: 'studentId and title are required' });
  const db = readDb();
  db.culturals.push({ id: freshId('cult'), studentId, title, description: description || '', date: date || new Date().toISOString().slice(0, 10) });
  writeDb(db);
  res.json({ ok: true });
});

// ---------- Teacher remarks ----------
router.get('/remarks', requireLogin, (req, res) => {
  const db = readDb();
  const studentId = req.session.role === 'student' ? req.session.userId : req.query.studentId;
  if (!studentId) return res.json({ remarks: [] });
  res.json({ remarks: db.remarks.filter(r => r.studentId === studentId) });
});

router.post('/remarks', requireLogin, requireRole('teacher', 'admin'), (req, res) => {
  const { studentId, text } = req.body;
  if (!studentId || !text) return res.status(400).json({ error: 'studentId and text are required' });
  const db = readDb();
  db.remarks.push({ id: freshId('rem'), studentId, teacherId: req.session.userId, text, date: new Date().toISOString() });
  writeDb(db);
  res.json({ ok: true });
});

// ---------- Calendar events ----------
router.get('/events', requireLogin, (req, res) => {
  const db = readDb();
  res.json({ events: db.events });
});

router.post('/events', requireLogin, requireRole('teacher', 'admin'), (req, res) => {
  const { title, date, description, departmentId } = req.body;
  if (!title || !date) return res.status(400).json({ error: 'title and date are required' });
  const db = readDb();
  db.events.push({ id: freshId('evt'), title, date, description: description || '', departmentId: departmentId || null });
  writeDb(db);
  res.json({ ok: true });
});

router.put('/events/:id', requireLogin, requireRole('teacher', 'admin'), (req, res) => {
  const { title, date, description } = req.body;
  const db = readDb();
  const evt = db.events.find(e => e.id === req.params.id);
  if (!evt) return res.status(404).json({ error: 'Event not found' });
  if (title != null && String(title).trim()) evt.title = String(title).trim();
  if (date) evt.date = date;
  if (description != null) evt.description = String(description);
  writeDb(db);
  res.json({ event: evt });
});

router.delete('/events/:id', requireLogin, requireRole('teacher', 'admin'), (req, res) => {
  const db = readDb();
  db.events = db.events.filter(e => e.id !== req.params.id);
  writeDb(db);
  res.json({ ok: true });
});

// ---------- Guidelines / college info ----------
router.get('/guidelines', requireLogin, (req, res) => {
  const db = readDb();
  res.json({ guidelines: db.guidelines });
});

router.post('/guidelines', requireLogin, requireRole('admin'), (req, res) => {
  const { title, body } = req.body;
  if (!title || !body) return res.status(400).json({ error: 'title and body are required' });
  const db = readDb();
  db.guidelines.push({ id: freshId('gd'), title, body });
  writeDb(db);
  res.json({ ok: true });
});

router.put('/guidelines/:id', requireLogin, requireRole('admin'), (req, res) => {
  const { title, body } = req.body;
  const db = readDb();
  const gd = db.guidelines.find(g => g.id === req.params.id);
  if (!gd) return res.status(404).json({ error: 'Guideline not found' });
  if (title != null && String(title).trim()) gd.title = String(title).trim();
  if (body != null && String(body).trim()) gd.body = String(body).trim();
  writeDb(db);
  res.json({ guideline: gd });
});

router.delete('/guidelines/:id', requireLogin, requireRole('admin'), (req, res) => {
  const db = readDb();
  db.guidelines = db.guidelines.filter(g => g.id !== req.params.id);
  writeDb(db);
  res.json({ ok: true });
});

module.exports = router;
