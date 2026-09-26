const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { MongoClient } = require('mongodb');
const app = express();
const PORT = process.env.PORT || 10000;
const MONGODB_URI = process.env.MONGODB_URI;
const ADMIN_SETUP_PASSWORD = process.env.ADMIN_SETUP_PASSWORD;
if (!MONGODB_URI) { console.error('MONGODB_URI missing'); process.exit(1); }
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));
function hashPassword(pw, salt) { return crypto.pbkdf2Sync(pw, salt, 100000, 64, 'sha512').toString('hex'); }
let collection;
function getDefaultSeed() { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'data.json'), 'utf8')); } catch(e){ return {}; } }
async function getData() { return await collection.findOne({ _id: 'site' }); }
async function saveField(section, value) { await collection.updateOne({ _id: 'site' }, { $set: { [section]: value } }); }
function requireAuth(handler) {
  return async (req, res) => {
    const password = req.headers['x-admin-password'];
    if (!password) return res.status(401).json({ error: 'Unauthorized' });
    const data = await getData();
    const hash = hashPassword(password, data.admin.salt);
    if (hash !== data.admin.passwordHash) return res.status(401).json({ error: 'Unauthorized' });
    await handler(req, res, data);
  };
}
app.get('/api/data', async (req, res) => { const { admin, _id, ...publicData } = await getData(); res.json(publicData); });
app.post('/api/admin/login', async (req, res) => { const { password } = req.body; const data = await getData(); const hash = hashPassword(password, data.admin.salt); if (hash === data.admin.passwordHash) return res.json({ ok: true }); res.status(401).json({ error: 'Ghalat password' }); });
app.post('/api/admin/save', requireAuth(async (req, res) => { await saveField(req.body.section, req.body.value); res.json({ ok: true }); }));
app.post('/api/admin/change-password', requireAuth(async (req, res) => { const salt = crypto.randomBytes(16).toString('hex'); await saveField('admin', { salt, passwordHash: hashPassword(req.body.newPassword, salt) }); res.json({ ok: true }); }));
app.get('/health', (req,res)=> res.send('OK'));
app.get('*', (req,res)=> res.sendFile(path.join(__dirname, 'public', 'index.html')));
async function start() {
  const client = new MongoClient(MONGODB_URI); await client.connect(); console.log('✅ MongoDB Connected');
  const db = client.db('fundedpro'); collection = db.collection('config');
  const existing = await collection.findOne({ _id: 'site' }); const seed = getDefaultSeed();
  if (!existing) { const pw = ADMIN_SETUP_PASSWORD || 'Admin7610'; const salt = crypto.randomBytes(16).toString('hex'); seed.admin = { salt, passwordHash: hashPassword(pw, salt) }; seed._id = 'site'; await collection.insertOne(seed); console.log('Seeded'); }
  else { let updates = {}; for (let k of ['siteName','hero','footer','stats','benefits','steps','wallets','brokers','packages','testimonials','faq']) { if (!(k in existing) && k in seed) updates[k] = seed[k]; } if (Object.keys(updates).length) await collection.updateOne({ _id: 'site' }, { $set: updates }); }
  app.listen(PORT, ()=> console.log('Live on '+PORT));
}
start().catch(e=>{ console.error(e); process.exit(1); });
