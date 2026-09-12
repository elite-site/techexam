const jwt = require('jsonwebtoken');
const config = require('./config');

const STUDENT_SECRET = config.jwtStudentSecret;
const ADMIN_SECRET = config.jwtAdminSecret;

function signStudent(student) {
  return jwt.sign(
    { sid: student.id, roll: student.roll_number, name: student.student_name, role: 'student' },
    STUDENT_SECRET,
    { expiresIn: '12h' }
  );
}

function signAdmin(admin) {
  return jwt.sign(
    { aid: admin.id, username: admin.username, role: 'admin' },
    ADMIN_SECRET,
    { expiresIn: '12h' }
  );
}

function verifyStudent(token) {
  return jwt.verify(token, STUDENT_SECRET);
}

function verifyAdmin(token) {
  return jwt.verify(token, ADMIN_SECRET);
}

function bearer(req) {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) return h.slice(7).trim();
  return null;
}

function requireAdmin(req, res, next) {
  const token = bearer(req);
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    req.admin = verifyAdmin(token);
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}

async function requireStudent(req, res, next) {
  const token = bearer(req);
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  let payload;
  try {
    payload = verifyStudent(token);
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
  try {
    const { rows } = await require('./db').query(
      'SELECT id, roll_number, student_name, year, section, round2_winner FROM students WHERE id = $1',
      [payload.sid]
    );
    if (!rows.length) return res.status(401).json({ error: 'Student no longer registered' });
    req.student = rows[0];
  } catch (e) {
    console.error('[requireStudent]', e.message);
    return res.status(500).json({ error: 'Database error' });
  }
  next();
}

module.exports = { signStudent, signAdmin, verifyStudent, verifyAdmin, requireAdmin, requireStudent };