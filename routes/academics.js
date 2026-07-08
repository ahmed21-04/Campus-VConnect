const express = require('express');
const fs = require('fs');
const path = require('path');
const { readDb, writeDb, freshId } = require('../db');
const { requireLogin, requireRole } = require('../middleware/auth');

const router = express.Router();

// ---- File uploads (PDFs, notes, question papers from device) ----
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const ALLOWED_EXT = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.txt', '.png', '.jpg', '.jpeg'];
const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB

/** Save a base64 data-URL upload to /uploads. Returns { url, fileName } or null. Throws on invalid input. */
function saveUpload(fileName, fileData) {
  if (!fileName || !fileData) return null;
  const ext = path.extname(String(fileName)).toLowerCase();
  if (!ALLOWED_EXT.includes(ext)) {
    throw new Error('File type not allowed. Use PDF, Word, PowerPoint, text or image files.');
  }
  const base64 = String(fileData).replace(/^data:[^;]*;base64,/, '');
  const buf = Buffer.from(base64, 'base64');
  if (!buf.length) throw new Error('Uploaded file is empty or unreadable.');
  if (buf.length > MAX_FILE_BYTES) throw new Error('File too large (max 25 MB).');
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  const stored = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
  fs.writeFileSync(path.join(UPLOADS_DIR, stored), buf);
  return { url: `/uploads/${stored}`, fileName: String(fileName) };
}

/** Delete a previously uploaded file if the url points into /uploads. */
function removeUpload(url) {
  if (!url || !String(url).startsWith('/uploads/')) return;
  try { fs.unlinkSync(path.join(UPLOADS_DIR, path.basename(url))); } catch (_) { /* already gone */ }
}

// Public: needed on the registration page before a session exists
router.get('/departments', (req, res) => {
  const db = readDb();
  res.json({ departments: db.departments });
});

router.get('/departments/:deptId/semesters', requireLogin, (req, res) => {
  const db = readDb();
  const semesters = db.semesters
    .filter(s => s.departmentId === req.params.deptId)
    .sort((a, b) => a.number - b.number)
    .map(s => ({
      ...s,
      subjectCount: db.subjects.filter(sub => sub.semesterId === s.id).length
    }));
  res.json({ semesters });
});

router.get('/semesters/:semId/subjects', requireLogin, (req, res) => {
  const db = readDb();
  const subjects = db.subjects
    .filter(s => s.semesterId === req.params.semId)
    .map(s => ({ id: s.id, name: s.name, noteCount: s.notes.length, pyqCount: s.pyqs.length, classLink: s.classLink }));
  res.json({ subjects });
});

router.get('/subjects/:subjectId', requireLogin, (req, res) => {
  const db = readDb();
  const subject = db.subjects.find(s => s.id === req.params.subjectId);
  if (!subject) return res.status(404).json({ error: 'Subject not found' });
  res.json({ subject });
});

// Teacher/admin can add a subject to a semester
router.post('/semesters/:semId/subjects', requireLogin, requireRole('teacher', 'admin'), (req, res) => {
  const { name, details } = req.body;
  if (!name) return res.status(400).json({ error: 'Subject name is required' });
  const db = readDb();
  const subject = { id: freshId('subj'), semesterId: req.params.semId, name, details: details || '', notes: [], pyqs: [], classLink: '' };
  db.subjects.push(subject);
  writeDb(db);
  res.json({ subject });
});

// Edit a subject's name and/or details
router.put('/subjects/:subjectId', requireLogin, requireRole('teacher', 'admin'), (req, res) => {
  const { name, details } = req.body;
  const db = readDb();
  const subject = db.subjects.find(s => s.id === req.params.subjectId);
  if (!subject) return res.status(404).json({ error: 'Subject not found' });
  if (name != null && String(name).trim()) subject.name = String(name).trim();
  if (details != null) subject.details = String(details);
  writeDb(db);
  res.json({ subject });
});

// Delete a subject entirely (also removes its uploaded files)
router.delete('/subjects/:subjectId', requireLogin, requireRole('teacher', 'admin'), (req, res) => {
  const db = readDb();
  const subject = db.subjects.find(s => s.id === req.params.subjectId);
  if (!subject) return res.status(404).json({ error: 'Subject not found' });
  [...subject.notes, ...subject.pyqs].forEach(item => removeUpload(item.url));
  db.subjects = db.subjects.filter(s => s.id !== req.params.subjectId);
  writeDb(db);
  res.json({ ok: true });
});

// Notes — accepts a link (url) and/or a file uploaded from the device (fileName + base64 fileData)
router.post('/subjects/:subjectId/notes', requireLogin, requireRole('teacher', 'admin'), (req, res) => {
  const { title, url, fileName, fileData } = req.body;
  if (!title) return res.status(400).json({ error: 'Note title is required' });
  let uploaded = null;
  try { uploaded = saveUpload(fileName, fileData); }
  catch (e) { return res.status(400).json({ error: e.message }); }
  const db = readDb();
  const subject = db.subjects.find(s => s.id === req.params.subjectId);
  if (!subject) { if (uploaded) removeUpload(uploaded.url); return res.status(404).json({ error: 'Subject not found' }); }
  subject.notes.push({
    id: freshId('note'),
    title,
    url: uploaded ? uploaded.url : (url || ''),
    fileName: uploaded ? uploaded.fileName : '',
    addedAt: new Date().toISOString()
  });
  writeDb(db);
  res.json({ subject });
});

router.delete('/subjects/:subjectId/notes/:noteId', requireLogin, requireRole('teacher', 'admin'), (req, res) => {
  const db = readDb();
  const subject = db.subjects.find(s => s.id === req.params.subjectId);
  if (!subject) return res.status(404).json({ error: 'Subject not found' });
  const removed = subject.notes.find(n => n.id === req.params.noteId);
  subject.notes = subject.notes.filter(n => n.id !== req.params.noteId);
  writeDb(db);
  if (removed) removeUpload(removed.url);
  res.json({ subject });
});

// Previous Year Questions — accepts a link (url) and/or a file uploaded from the device
router.post('/subjects/:subjectId/pyqs', requireLogin, requireRole('teacher', 'admin'), (req, res) => {
  const { year, url, fileName, fileData } = req.body;
  if (!year) return res.status(400).json({ error: 'Year is required' });
  let uploaded = null;
  try { uploaded = saveUpload(fileName, fileData); }
  catch (e) { return res.status(400).json({ error: e.message }); }
  const db = readDb();
  const subject = db.subjects.find(s => s.id === req.params.subjectId);
  if (!subject) { if (uploaded) removeUpload(uploaded.url); return res.status(404).json({ error: 'Subject not found' }); }
  subject.pyqs.push({
    id: freshId('pyq'),
    year,
    url: uploaded ? uploaded.url : (url || ''),
    fileName: uploaded ? uploaded.fileName : '',
    addedAt: new Date().toISOString()
  });
  writeDb(db);
  res.json({ subject });
});

router.delete('/subjects/:subjectId/pyqs/:pyqId', requireLogin, requireRole('teacher', 'admin'), (req, res) => {
  const db = readDb();
  const subject = db.subjects.find(s => s.id === req.params.subjectId);
  if (!subject) return res.status(404).json({ error: 'Subject not found' });
  const removed = subject.pyqs.find(p => p.id === req.params.pyqId);
  subject.pyqs = subject.pyqs.filter(p => p.id !== req.params.pyqId);
  writeDb(db);
  if (removed) removeUpload(removed.url);
  res.json({ subject });
});

// Class link (YouTube)
router.put('/subjects/:subjectId/class-link', requireLogin, requireRole('teacher', 'admin'), (req, res) => {
  const { classLink } = req.body;
  const db = readDb();
  const subject = db.subjects.find(s => s.id === req.params.subjectId);
  if (!subject) return res.status(404).json({ error: 'Subject not found' });
  subject.classLink = classLink || '';
  writeDb(db);
  res.json({ subject });
});

module.exports = router;
