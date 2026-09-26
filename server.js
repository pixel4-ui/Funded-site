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
  catch(e){ return { siteName:"FundedPro", hero:{}, brokers:[{name:"Exness"}], wallets:[], packages:[] }; }
}
async function getData() { return await collection.findOne({ _id: 'site' }); }
async function saveField(s, v) { await collection.updateOne({ _id: 'site' }, { $set: { [s]: v } }); }

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
  try { const doc = await getData(); const { admin, _id,...publicData } = doc; res.json(publicData); }
  catch(e){ res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/admin/login', async (req, res) => {
  try {
    const { password } = req.body;
    const data = await getData();
    const hash = hashPassword(password, data.admin.salt);
    if (hash === data.admin.passwordHash) return res.json({ ok: true });
    res.status(401).json({ error: 'Ghalat password - Default Admin7610' });
  } catch(e){ res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/admin/save', requireAuth(async (req, res) => {
  await saveField(req.body.section, req.body.value);
  res.json({ ok: true });
}));

app.get('/health', (req,res)=> res.send('OK'));

// ADMIN - Built-in - No public/admin.html needed
app.get('/admin', (req,res)=>{
  const html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Admin V5 Working</title><style>body{background:#05070d;color:#fff;font-family:Arial;padding:20px;max-width:700px;margin:auto}input{width:100%;padding:14px;margin:8px 0;background:#0d1220;border:1px solid #1c2333;color:#fff;border-radius:8px}button{width:100%;padding:14px;background:#00e5a0;color:#000;border:none;border-radius:8px;font-weight:900;cursor:pointer;margin:6px 0}img.qr{width:120px;height:120px;background:#fff;border-radius:8px;display:block;margin:10px 0}.box{background:#0d1220;padding:15px;border-radius:10px;margin:15px 0;border:1px solid #1c2333}</style></head><body><h2 style="color:#00e5a0;text-align:center">ADMIN V5 - 100% WORKING</h2><div id="loginBox"><input type="password" id="pass" value="Admin7610"><button id="loginBtn">LOGIN KRO - CLICK HERE</button><div id="msg" style="margin-top:10px;padding:10px;background:#0d1220;border-radius:8px">Ready</div></div><div id="panel" style="display:none"><h3>Login OK - MongoDB Connected</h3><div class="box"><h4>Wallets + QR Upload</h4><div id="wallets"></div><button id="addW">+ Add Wallet</button><button id="saveW" style="background:#3b82f6">Save Wallets</button></div><div class="box"><h4>Brokers - Exness</h4><div id="brokers"></div><button id="addB">+ Add Exness</button><button id="saveB">Save Brokers</button></div><a href="/" style="color:#00e5a0;display:block;text-align:center;margin-top:15px">View Site</a></div><script>let adminPass="",siteData=null;document.getElementById("loginBtn").addEventListener("click",async()=>{const p=document.getElementById("pass").value.trim();const msg=document.getElementById("msg");const btn=document.getElementById("loginBtn");btn.disabled=true;btn.innerText="Checking...";try{const res=await fetch("/api/admin/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password:p})});const d=await res.json();if(!res.ok) throw new Error(d.error);adminPass=p;localStorage.setItem("adminPass",p);document.getElementById("loginBox").style.display="none";document.getElementById("panel").style.display="block";const r2=await fetch("/api/data");siteData=await r2.json();renderW();renderB();}catch(e){msg.innerHTML="ERROR: "+e.message;btn.disabled=false;btn.innerText="LOGIN KRO - CLICK HERE";}});function renderW(){let h="";(siteData.wallets||[]).forEach((w,i)=>{h+="<div style=\\"border:1px solid #1c2333;padding:10px;margin:8px 0;border-radius:8px;background:#05070d\\"><input placeholder=\\"Network\\" value=\\""+(w.network||"").replace(/"/g,"")+"\\" data-i=\\""+i+"\\" data-k=\\"network\\" class=\\"w-in\\"><input placeholder=\\"Address\\" value=\\""+(w.address||"").replace(/"/g,"")+"\\" data-i=\\""+i+"\\" data-k=\\"address\\" class=\\"w-in\\">"+(w.qrImage?"<img class=\\"qr\\" src=\\""+w.qrImage+"\\">":"<div style=\\"color:#8892a6;font-size:12px\\">No QR</div>")+"<input type=\\"file\\" accept=\\"image/*\\" onchange=\\"upQR("+i+",this)\\" style=\\"margin-top:8px\\"><input type=\\"hidden\\" value=\\" data-i=\\""+i+"\\" data-k=\\"qrImage\\" class=\\"w-in\\" id=\\"qr-"+i+"\\"></div>";});document.getElementById("wallets").innerHTML=h;setTimeout(()=>{(siteData.wallets||[]).forEach((w,i)=>{const el=document.getElementById("qr-"+i);if(el) el.value=w.qrImage||"";});},100);}window.upQR=function(i,input){const f=input.files[0];if(!f) return;const r=new FileReader();r.onload=e=>{document.getElementById("qr-"+i).value=e.target.result;alert("QR Loaded! Save dabao");};r.readAsDataURL(f);};function renderB(){let h="";(siteData.brokers||[]).forEach((b,i)=>{h+="<div style=\\"display:flex;gap:6px;margin:6px 0\\"><input value=\\""+b.name+"\\" data-i=\\""+i+"\\" class=\\"b-in\\" style=\\"flex:1\\"><button onclick=\\"siteData.brokers.splice("+i+",1);renderB()\\" style=\\"width:auto\\">X</button></div>";});document.getElementById("brokers").innerHTML=h;}document.getElementById("addW").addEventListener("click",()=>{siteData.wallets.push({network:"USDT TRC20 (Exness)",address:"",qrImage:null});renderW();});document.getElementById("saveW").addEventListener("click",async()=>{let arr=[];document.querySelectorAll(".w-in").forEach(el=>{let i=el.dataset.i,k=el.dataset.k;if(!arr[i]) arr[i]={};arr[i][k]=el.value;if(k=="qrImage"&&!el.value&&siteData.wallets[i]) arr[i][k]=siteData.wallets[i].qrImage||null;});const res=await fetch("/api/admin/save",{method:"POST",headers:{"Content-Type":"application/json","x
