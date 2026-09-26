const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { MongoClient } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 10000;
const MONGODB_URI = process.env.MONGODB_URI;
const ADMIN_SETUP_PASSWORD = process.env.ADMIN_SETUP_PASSWORD;

if (!MONGODB_URI) {
  console.error('MONGODB_URI missing');
  process.exit(1);
}

app.use(express.json({ limit: '10mb' }));

// IMPORTANT: public folder se serve karo
const publicPath = path.join(__dirname, 'public');
console.log('Public path:', publicPath, 'Exists:', fs.existsSync(publicPath));
app.use(express.static(publicPath));

function hashPassword(pw, salt) { 
  return crypto.pbkdf2Sync(pw, salt, 100000, 64, 'sha512').toString('hex'); 
}

let collection;

function getDefaultSeed() { 
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'data.json'), 'utf8')); } 
  catch(e){ return {}; } 
}

async function getData() { 
  const doc = await collection.findOne({ _id: 'site' }); 
  return doc; 
}

async function saveField(section, value) { 
  await collection.updateOne({ _id: 'site' }, { $set: { [section]: value } }); 
}

function requireAuth(handler) {
  return async (req, res) => {
    try {
      const password = req.headers['x-admin-password'];
      if (!password) return res.status(401).json({ error: 'Unauthorized' });
      const data = await getData();
      const hash = hashPassword(password, data.admin.salt);
      if (hash !== data.admin.passwordHash) return res.status(401).json({ error: 'Unauthorized' });
      await handler(req, res, data);
    } catch(err){ res.status(500).json({ error: 'Server error' }); }
  };
}

// API Routes
app.get('/api/data', async (req, res) => {
  try {
    const doc = await getData();
    const { admin, _id, ...publicData } = doc;
    res.json(publicData);
  } catch(e){ res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/admin/login', async (req, res) => {
  try {
    const { password } = req.body;
    const data = await getData();
    const hash = hashPassword(password, data.admin.salt);
    if (hash === data.admin.passwordHash) return res.json({ ok: true });
    res.status(401).json({ error: 'Ghalat password' });
  } catch(e){ res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/admin/save', requireAuth(async (req, res) => {
  await saveField(req.body.section, req.body.value);
  res.json({ ok: true });
}));

app.post('/api/admin/change-password', requireAuth(async (req, res) => {
  const salt = crypto.randomBytes(16).toString('hex');
  await saveField('admin', { salt, passwordHash: hashPassword(req.body.newPassword, salt) });
  res.json({ ok: true });
}));

app.get('/health', (req,res)=> res.send('OK'));

// FINAL FIX for Not Found - Express 5 compatible
app.use((req, res) => {
  const indexFile = path.join(publicPath, 'index.html');
  if (fs.existsSync(indexFile)) {
    res.sendFile(indexFile);
  } else {
    res.status(404).send(`Not Found - public/index.html missing at ${indexFile}. GitHub me check karo public folder me index.html hai ya nahi. Files: ${fs.existsSync(publicPath) ? fs.readdirSync(publicPath).join(',') : 'public folder missing'}`);
  }
});

async function start() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  console.log('✅ MongoDB Connected');
  const db = client.db('fundedpro');
  collection = db.collection('config');
  const existing = await collection.findOne({ _id: 'site' });
  const seed = getDefaultSeed();
  if (!existing) {
    const pw = ADMIN_SETUP_PASSWORD || 'Admin7610';
    const salt = crypto.randomBytes(16).toString('hex');
    seed.admin = { salt, passwordHash: hashPassword(pw, salt) };
    seed._id = 'site';
    await collection.insertOne(seed);
    console.log('Seeded with Exness broker');
  } else {
    // Auto add missing fields including Exness broker
    let updates = {};
    if (!existing.brokers || !existing.brokers.find(b=>b.name==='Exness')) {
      // Add Exness if not present
      const brokers = existing.brokers || [];
      if (!brokers.find(b=>b.name==='Exness')) {
        brokers.unshift({ name: 'Exness' });
        updates.brokers = brokers;
      }
    }
    // Add any other missing fields from seed
    for (let k of ['siteName','hero','footer','stats','benefits','steps','wallets','packages','testimonials','faq']) {
      if (!(k in existing) && k in seed) updates[k] = seed[k];
    }
    if (Object.keys(updates).length > 0) {
      await collection.updateOne({ _id: 'site' }, { $set: updates });
      console.log('Updated missing fields:', Object.keys(updates));
    }
  }
  app.listen(PORT, () => console.log('Server running on ' + PORT));
}

start().catch(err => { console.error(err); process.exit(1); });
