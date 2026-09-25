const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const DATA_FILE = path.join(__dirname, 'data.json');
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '5mb' })); // higher limit to allow QR image upload
app.use(express.static(path.join(__dirname, 'public')));

function readData() { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
function writeData(data) { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); }
function hashPassword(pw, salt) { return crypto.pbkdf2Sync(pw, salt, 100000, 64, 'sha512').toString('hex'); }

// Stateless auth: password checked fresh on every request (no session to lose on restart)
function requireAuth(req, res, next) {
  const password = req.headers['x-admin-password'];
  if (!password) return res.status(401).json({ error: 'Unauthorized' });
  const data = readData();
  const hash = hashPassword(password, data.admin.salt);
  if (hash === data.admin.passwordHash) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

// ---- Public: everything except admin credentials ----
app.get('/api/data', (req, res) => {
  const { admin, ...publicData } = readData();
  res.json(publicData);
});

// ---- Admin auth: just verifies the password is correct ----
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  const data = readData();
  const hash = hashPassword(password, data.admin.salt);
  if (hash === data.admin.passwordHash) {
    return res.json({ ok: true });
  }
  res.status(401).json({ error: 'Ghalat password' });
});

// ---- Admin protected: save any section of the CMS ----
// Body: { section: "siteName"|"hero"|"footer"|"stats"|"benefits"|"steps"|"wallet"|"packages"|"testimonials"|"faq", value: <new value> }
app.post('/api/admin/save', requireAuth, (req, res) => {
  const { section, value } = req.body;
  const allowed = ['siteName','hero','footer','stats','benefits','steps','wallet','packages','testimonials','faq'];
  if (!allowed.includes(section)) return res.status(400).json({ error: 'Invalid section' });
  const data = readData();
  data[section] = value;
  writeData(data);
  res.json({ ok: true });
});

app.post('/api/admin/change-password', requireAuth, (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Password kam se kam 6 characters' });
  const data = readData();
  const salt = crypto.randomBytes(16).toString('hex');
  data.admin = { salt, passwordHash: hashPassword(newPassword, salt) };
  writeData(data);
  res.json({ ok: true });
});

app.listen(PORT, () => console.log(`Server running: http://localhost:${PORT}`));
