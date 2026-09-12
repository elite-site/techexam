const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { signAdmin, requireAdmin } = require('../auth');

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }
    const { rows } = await query('SELECT * FROM admins WHERE username = $1', [username]);
    if (!rows.length) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }
    const admin = rows[0];
    const ok = await bcrypt.compare(password, admin.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }
    const token = signAdmin(admin);
    return res.json({ token, admin: { id: admin.id, username: admin.username } });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error during login.' });
  }
});

router.get('/me', requireAdmin, (req, res) => {
  res.json({ admin: req.admin });
});

module.exports = router;