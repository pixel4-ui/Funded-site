# Funded Trading Site — Setup Guide

## Files
- `server.js` — backend (packages, wallet, admin login sab yahan handle hota hai)
- `data.json` — apka data (packages, wallet address, admin password) — yeh save hota rehta hai
- `public/index.html` — main website
- `public/admin.html` — admin panel (`/admin.html` per khulega)
- `setup.js` — pehli dafa admin password set karne ke liye

## Local test karne ke liye
```
npm install
node setup.js YourStrongPassword123
npm start
```
Phir browser mein:
- Website: `http://localhost:3000`
- Admin: `http://localhost:3000/admin.html`

## Live deploy karne ke liye (real domain per)
Koi bhi Node.js hosting chalega, jaise:
- **Render.com** (free tier available) — GitHub repo connect karein, "Web Service" banayein
- **Railway.app**
- Apna VPS (DigitalOcean/Hostinger VPS) — `pm2` se server chalayein taake crash pe restart ho

Steps (kisi bhi host per same):
1. Yeh poora folder GitHub repo mein daalein ya host per upload karein
2. Host per env se `node setup.js YourPassword` ek dafa chalayein (ya wahan ka terminal use karein)
3. `npm install && npm start`
4. Apna domain (jaise binaryfundedofficial.com) is server se point karein

## Admin panel se kya kya change kar sakte hain
- Package ka naam, size, price, profit split, features (Chota/Bara dono)
- Naya package add/remove
- Wallet address + network (USDT, BTC, etc.)
- Admin password

Sab changes turant live website per show hongi — koi coding dobara nahi karni.

## Zaroori Security Note
- Admin password strong rakhein aur kisi ko share na karein
- HTTPS zaroor use karein (Render/Railway automatically deti hain) taake password aur data safe rahe
- `data.json` file ka backup rakhte rahein
