const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { MongoClient } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 10000;
const MONGODB_URI = process.env.MONGODB_URI;

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function hashPassword(pw, salt) {
  return crypto.pbkdf2Sync(pw, salt, 100000, 64, 'sha512').toString('hex');
}

let collection;

function getDefaultSeed() {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'data.json'), 'utf8')); }
  catch(e){ return { siteName:"FundedPro", brokers:[{name:"Exness"}], wallets:[] }; }
}

async function getData() {
  return await collection.findOne({ _id: 'site' });
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
      if (hash!== data.admin.passwordHash) return res.status(401).json({ error: 'Unauthorized' });
      await handler(req, res, data);
    } catch(err){ res.status(500).json({ error: 'Server error' }); }
  };
}

app.get('/api/data', async (req, res) => {
  try {
    const doc = await getData();
    const { admin, _id,...publicData } = doc;
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

app.get('/admin', (req,res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

async function start() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('fundedpro');
  collection = db.collection('config');
  const existing = await collection.findOne({ _id: 'site' });
  if (!existing) {
    const seed = getDefaultSeed();
    const salt = crypto.randomBytes(16).toString('hex');
    seed.admin = { salt, passwordHash: hashPassword('Admin7610', salt) };
    seed._id = 'site';
    await collection.insertOne(seed);
  }
  app.listen(PORT, () => console.log('Server running ' + PORT));
}

start();
