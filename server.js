const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const DATA_FILE = path.join(__dirname, 'data.json');
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---- Helpers ----
function readData() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}
function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}
function hashPassword(pw, salt) {
  return crypto.pbkdf2Sync(pw, salt, 100000, 64, 'sha512').toString('hex');
}

// Simple in-memory session tokens (fine for a single-admin small site)
const activeSessions = new Set();
function requireAuth(req, res, next) {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (token && activeSessions.has(token)) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

// ---- Public API ----
app.get('/api/data', (req, res) => {
  const data = readData();
  res.json({ packages: data.packages, wallet: data.wallet });
});

// ---- Admin auth ----
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  const data = readData();
  const hash = hashPassword(password, data.admin.salt);
  if (hash === data.admin.passwordHash) {
    const token = crypto.randomBytes(32).toString('hex');
    activeSessions.add(token);
    return res.json({ token });
  }
  res.status(401).json({ error: 'Ghalat password' });
});

app.post('/api/admin/logout', requireAuth, (req, res) => {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  activeSessions.delete(token);
  res.json({ ok: true });
});

// ---- Admin protected: update packages ----
app.post('/api/admin/packages', requireAuth, (req, res) => {
  const { packages } = req.body;
  if (!Array.isArray(packages)) return res.status(400).json({ error: 'Invalid data' });
  const data = readData();
  data.packages = packages;
  writeData(data);
  res.json({ ok: true, packages });
});

// ---- Admin protected: update wallet address ----
app.post('/api/admin/wallet', requireAuth, (req, res) => {
  const { network, address } = req.body;
  if (!address) return res.status(400).json({ error: 'Address required' });
  const data = readData();
  data.wallet = { network: network || data.wallet.network, address };
  writeData(data);
  res.json({ ok: true, wallet: data.wallet });
});

// ---- Admin protected: change admin password ----
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
