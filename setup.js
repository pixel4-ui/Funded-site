// Run once: node setup.js YourNewAdminPassword
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data.json');
const newPassword = process.argv[2];

if (!newPassword || newPassword.length < 6) {
  console.log('Use karein: node setup.js YourPassword  (kam se kam 6 characters)');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
const salt = crypto.randomBytes(16).toString('hex');
const hash = crypto.pbkdf2Sync(newPassword, salt, 100000, 64, 'sha512').toString('hex');
data.admin = { salt, passwordHash: hash };
fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
console.log('Admin password set ho gaya. Ab /admin.html per login kar sakte hain.');
