const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { signStudent } = require('../auth');
const { requireStudent } = require('../auth');

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const roll = String(req.body.roll_number || '').trim();
    const password = String(req.body.password || '');
    if (!roll || !password) {
      return res.status(400).json({ error: 'Roll number and password are required.' });
    }
    const { rows } = await query(
      'SELECT * FROM students WHERE lower(roll_number) = lower($1)',
      [roll]
    );
    if (!rows.length) {
      return res.status(401).json({ error: 'Invalid roll number. Please check and try again.' });
    }
    const student = rows[0];
    const ok = await bcrypt.compare(password, student.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid password. Please try again.' });
    }
    const token = signStudent(student);
    return res.json({
      token,
      student: {
        id: student.id,
        roll_number: student.roll_number,
        student_name: student.student_name,
        year: student.year,
        section: student.section,
      },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error during login.' });
  }
});

router.get('/me', requireStudent, (req, res) => {
  res.json({ student: req.student });
});

module.exports = router;