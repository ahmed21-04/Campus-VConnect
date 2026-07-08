const express = require('express');
const { readDb, writeDb, freshId } = require('../db');
const { requireLogin } = require('../middleware/auth');

const router = express.Router();

function publicUser(u) {
  const { passwordHash, ...rest } = u;
  return rest;
}

// Existing databases were seeded before chat existed
function ensureMessages(db) {
  if (!Array.isArray(db.messages)) db.messages = [];
}

function conversation(db, a, b) {
  return db.messages
    .filter(m => (m.fromUserId === a && m.toUserId === b) || (m.fromUserId === b && m.toUserId === a))
    .sort((x, y) => new Date(x.time) - new Date(y.time));
}

// Contacts: students see teachers & admins; teachers/admins see students.
// Includes last message preview + unread count per contact.
router.get('/chat/contacts', requireLogin, (req, res) => {
  const db = readDb();
  ensureMessages(db);
  const me = db.users.find(u => u.id === req.session.userId);
  if (!me) return res.status(401).json({ error: 'Session invalid' });

  const contacts = me.role === 'student'
    ? db.users.filter(u => u.role === 'teacher' || u.role === 'admin')
    : db.users.filter(u => u.role === 'student');

  const out = contacts.map(c => {
    const msgs = conversation(db, me.id, c.id);
    const last = msgs[msgs.length - 1] || null;
    const unread = msgs.filter(m => m.toUserId === me.id && !m.read).length;
    return {
      ...publicUser(c),
      lastMessage: last ? { text: last.text, time: last.time, fromMe: last.fromUserId === me.id } : null,
      unread
    };
  }).sort((a, b) => {
    const ta = a.lastMessage ? new Date(a.lastMessage.time) : 0;
    const tb = b.lastMessage ? new Date(b.lastMessage.time) : 0;
    return tb - ta;
  });

  res.json({ contacts: out });
});

// Full conversation with one user; marks incoming messages as read.
router.get('/chat/messages/:userId', requireLogin, (req, res) => {
  const db = readDb();
  ensureMessages(db);
  const me = db.users.find(u => u.id === req.session.userId);
  const other = db.users.find(u => u.id === req.params.userId);
  if (!me) return res.status(401).json({ error: 'Session invalid' });
  if (!other) return res.status(404).json({ error: 'User not found' });

  let changed = false;
  db.messages.forEach(m => {
    if (m.fromUserId === other.id && m.toUserId === me.id && !m.read) { m.read = true; changed = true; }
  });
  if (changed) writeDb(db);

  res.json({ messages: conversation(db, me.id, other.id), with: publicUser(other) });
});

// Send a message. Students may message teachers/admins; staff may message students.
router.post('/chat/messages', requireLogin, (req, res) => {
  const { toUserId, text } = req.body;
  if (!toUserId || !text || !String(text).trim()) {
    return res.status(400).json({ error: 'toUserId and text are required' });
  }
  const db = readDb();
  ensureMessages(db);
  const me = db.users.find(u => u.id === req.session.userId);
  const to = db.users.find(u => u.id === toUserId);
  if (!me) return res.status(401).json({ error: 'Session invalid' });
  if (!to) return res.status(404).json({ error: 'Recipient not found' });

  const ok = me.role === 'student'
    ? (to.role === 'teacher' || to.role === 'admin')
    : to.role === 'student';
  if (!ok) return res.status(403).json({ error: 'You can only chat between students and teachers' });

  const msg = {
    id: freshId('msg'),
    fromUserId: me.id,
    toUserId: to.id,
    text: String(text).trim().slice(0, 4000),
    time: new Date().toISOString(),
    read: false
  };
  db.messages.push(msg);
  writeDb(db);
  res.json({ message: msg });
});

module.exports = router;
