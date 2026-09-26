const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { MongoClient } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;
const ADMIN_SETUP_PASSWORD = process.env.ADMIN_SETUP_PASSWORD; // only used the very first time, to create the admin account

if (!MONGODB_URI) {
  console.error('ERROR: MONGODB_URI environment variable is not set. Add it in Render → Environment.');
  process.exit(1);
}

app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function hashPassword(pw, salt) { return crypto.pbkdf2Sync(pw, salt, 100000, 64, 'sha512').toString('hex'); }

let collection;

async function getData() {
  return await collection.findOne({ _id: 'site' });
}
async function saveField(section, value) {
  await collection.updateOne({ _id: 'site' }, { $set: { [section]: value } });
}

function requireAuth(handler) {
  return async (req, res) => {
    const password = req.headers['x-admin-password'];
    if (!password) return res.status(401).json({ error: 'Unauthorized' });
    const data = await getData();
    const hash = hashPassword(password, data.admin.salt);
    if (hash !== data.admin.passwordHash) return res.status(401).json({ error: 'Unauthorized' });
    handler(req, res, data);
  };
}

// ---- Public: everything except admin credentials ----
app.get('/api/data', async (req, res) => {
  const { admin, _id, ...publicData } = await getData();
  res.json(publicData);
});

// ---- Admin auth: just verifies the password is correct ----
app.post('/api/admin/login', async (req, res) => {
  const { password } = req.body;
  const data = await getData();
  const hash = hashPassword(password, data.admin.salt);
  if (hash === data.admin.passwordHash) return res.json({ ok: true });
  res.status(401).json({ error: 'Ghalat password' });
});

// ---- Admin protected: save any section of the CMS ----
app.post('/api/admin/save', requireAuth(async (req, res) => {
  const { section, value } = req.body;
  const allowed = ['siteName','hero','footer','stats','benefits','steps','wallets','brokers','packages','testimonials','faq'];
  if (!allowed.includes(section)) return res.status(400).json({ error: 'Invalid section' });
  await saveField(section, value);
  res.json({ ok: true });
}));

app.post('/api/admin/change-password', requireAuth(async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Password kam se kam 6 characters' });
  const salt = crypto.randomBytes(16).toString('hex');
  await saveField('admin', { salt, passwordHash: hashPassword(newPassword, salt) });
  res.json({ ok: true });
}));

async function start() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('fundedpro');
  collection = db.collection('config');

  const existing = await collection.findOne({ _id: 'site' });
  if (!existing) {
    console.log('No data found in database — seeding initial data...');
    const seed = JSON.parse(fs.readFileSync(path.join(__dirname, 'data.json'), 'utf8'));
    const setupPassword = ADMIN_SETUP_PASSWORD || 'changeme123';
    const salt = crypto.randomBytes(16).toString('hex');
    seed.admin = { salt, passwordHash: hashPassword(setupPassword, salt) };
    seed._id = 'site';
    await collection.insertOne(seed);
    console.log('Seeded. Admin password set from ADMIN_SETUP_PASSWORD (or default "changeme123" if not set).');
  }

  app.listen(PORT, () => console.log(`Server running on port ${PORT}, connected to MongoDB`));
}

start().catch(err => { console.error('Failed to start:', err); process.exit(1); });
