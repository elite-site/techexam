const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const studentAuth = require('./routes/studentAuth');
const adminAuth = require('./routes/adminAuth');
const student = require('./routes/student');
const admin = require('./routes/admin');

const app = express();

process.on('unhandledRejection', (e) => console.error('[unhandledRejection]', e && e.message || e));
process.on('uncaughtException', (e) => console.error('[uncaughtException]', e && e.message || e));

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.use('/api/auth/student', studentAuth);
app.use('/api/auth/admin', adminAuth);
app.use('/api/student', student);
app.use('/api/admin', admin);

// ---- Production static serving (built React SPA) ----
const dist = path.resolve(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  // SPA history fallback (skip API routes)
  app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(dist, 'index.html'));
  });
}

app.use((err, req, res, next) => {
  console.error('[error]', err.message);
  if (err) return res.status(500).json({ error: err.message || 'Server error.' });
  next();
});

app.listen(config.port, () => {
  console.log('ELITE Examination System running');
  console.log(`  Student portal: http://localhost:${config.port}/student`);
  console.log(`  Admin portal:   http://localhost:${config.port}/admin`);
  console.log(`  API:            http://localhost:${config.port}/api`);
});