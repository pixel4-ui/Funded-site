const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { MongoClient } = require('mongodb');
const app = express();
const PORT = process.env.PORT || 10000;
const MONGODB_URI = process.env.MONGODB_URI;
const ADMIN_SETUP_PASSWORD = process.env.ADMIN_SETUP_PASSWORD;
if (!MONGODB_URI) { console.error('ERROR: MONGODB_URI missing'); process.exit(1); }
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));
function hashPassword(pw, salt) { return crypto.pbkdf2Sync(pw, salt, 100000, 64, 'sha512').toString('hex'); }
let collection;
function getDefaultSeed() { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'data.json'), 'utf8')); } catch(e){ return {}; } }
async function getData() { const doc = await collection.findOne({ _id: 'site' }); if (!doc) throw new Error('Site data not found'); return doc; }
async function saveField(section, value) { await collection.updateOne({ _id: 'site' }, { $set: { [section]: value } }); }
function requireAuth(handler) {
  return async (req, res) => {
    try {
      const password = req.headers['x-admin-password'];
      if (!password) return res.status(401).json({ error: 'Unauthorized' });
      const data = await getData();
      if (!data.admin ||!data.admin.salt) return res.status(500).json({ error: 'Admin not setup' });
      const hash = hashPassword(password, data.admin.salt);
      if (hash!== data.admin.passwordHash) return res.status(401).json({ error: 'Unauthorized' });
      await handler(req, res, data);
    } catch(err){ console.error(err); res.status(500).json({ error: 'Server error' }); }
  };
}
app.get('/api/data', async (req, res) => {
  try { const doc = await getData(); const { admin, _id,...publicData } = doc; res.json(publicData); } catch(e){ res.status(500).json({ error: 'Failed' }); }
});
app.post('/api/admin/login', async (req, res) => {
  try { const { password } = req.body; const data = await getData(); const hash = hashPassword(password, data.admin.salt); if (hash === data.admin.passwordHash) return res.json({ ok: true }); res.status(401).json({ error: 'Ghalat password' }); } catch(e){ res.status(500).json({ error: 'Server error' }); }
});
app.post('/api/admin/save', requireAuth(async (req, res) => {
  const { section, value } = req.body;
  const allowed = ['siteName','hero','footer','stats','benefits','steps','wallets','brokers','packages','testimonials','faq'];
  if (!allowed.includes(section)) return res.status(400).json({ error: 'Invalid section' });
  await saveField(section, value); res.json({ ok: true });
}));
app.post('/api/admin/change-password', requireAuth(async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Min 6 chars' });
  const salt = crypto.randomBytes(16).toString('hex');
  await saveField('admin', { salt, passwordHash: hashPassword(newPassword, salt) }); res.json({ ok: true });
}));
app.get('/health', (req,res)=> res.send('OK'));
app.get('*', (req,res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });
async function start() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect(); console.log('MongoDB Connected');
  const db = client.db('fundedpro'); collection = db.collection('config');
  const existing = await collection.findOne({ _id: 'site' });
  const seed = getDefaultSeed();
  if (!existing) {
    const setupPassword = ADMIN_SETUP_PASSWORD || 'Admin7610';
    const salt = crypto.randomBytes(16).toString('hex');
    seed.admin = { salt, passwordHash: hashPassword(setupPassword, salt) }; seed._id = 'site';
    await collection.insertOne(seed); console.log('Seeded');
  } else {
    let updates = {}; let needsUpdate = false;
    for (let key of ['siteName','hero','footer','stats','benefits','steps','wallets','brokers','packages','testimonials','faq']) {
      if (!(key in existing) && key in seed) { updates[key] = seed[key]; needsUpdate = true; }
    }
    if (needsUpdate) await collection.updateOne({ _id: 'site' }, { $set: updates });
    if (!existing.admin ||!existing.admin.salt) {
      const setupPassword = ADMIN_SETUP_PASSWORD || 'Admin7610';
      const salt = crypto.randomBytes(16).toString('hex');
      await collection.updateOne({ _id: 'site' }, { $set: { admin: { salt, passwordHash: hashPassword(setupPassword, salt) } } });
    }
  }
  app.listen(PORT, () => console.log('Server on', PORT));
}
start().catch(err => { console.error(err); process.exit(1); });
