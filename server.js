const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
app.use(express.json());
app.use(express.static('public'));

const configPath = path.join(__dirname, 'config.json');

// Default Config
let defaultConfig = {
  siteName: "FUNDEDPRO",
  heroTitle: "GET FUNDED UP TO $200,000",
  heroSub: "Trade our capital. Keep up to 90% profit. Instant funding available.",
  users: "127,432",
  payout: "$8.2M+",
  trc20: "TLxK9q7pR2mN4vB8cJ5hG3fD1sA6zW0eQ",
  qrImage: "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=TLxK9q7pR2mN4vB8cJ5hG3fD1sA6zW0eQ",
  reviews: [
    {name:"John D.", text:"Best prop firm! Got $50k funded in 3 days.", stars:5},
    {name:"Ahmed K.", text:"Payout received in 24h. Very professional.", stars:5},
    {name:"Sarah M.", text:"TRC20 payment was instant. Trusted!", stars:5}
  ],
  faq: [
    {q:"How fast is payout?", a:"Payouts are processed within 24 hours via TRC20, Bank or Crypto."},
    {q:"What is profit split?", a:"Up to 90% profit split for consistent traders."}
  ],
  plans: [
    {price:"$89", account:"$15,000", profit:"90%"},
    {price:"$189", account:"$50,000", profit:"90%"},
    {price:"$349", account:"$100,000", profit:"90%"}
  ]
};

if(!fs.existsSync(configPath)){
  fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
}

app.get('/api/config', (req,res)=>{
  res.sendFile(configPath);
});

app.post('/api/config', (req,res)=>{
  fs.writeFileSync(configPath, JSON.stringify(req.body, null, 2));
  res.json({success:true});
});

app.get('*', (req,res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log('Live on', PORT));
