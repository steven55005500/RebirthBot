require("dotenv").config();

const { ethers } = require("ethers");
const TelegramBot = require("node-telegram-bot-api");

// ================= ENV =================

const RPC = process.env.RPC;
const TELEGRAM_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = process.env.CHAT_ID;

// ================= ADDRESSES =================

const WATCH_ADDRESS =
"0xc8Bcf348A74018B11DCB52765Bd818E85FBE6A3f".toLowerCase();

const USDT_CONTRACT =
"0x55d398326f99059ff775485246999027b3197955";

// ================= CHECK =================

if (!RPC || !TELEGRAM_TOKEN || !CHANNEL_ID) {
console.log("❌ Missing ENV values");
process.exit(1);
}

// ================= PROVIDER =================

const provider = new ethers.JsonRpcProvider(RPC);
provider.pollingInterval = 4000;

// ================= TELEGRAM =================

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });

// ================= ABI =================

const ABI = [
"event Transfer(address indexed from,address indexed to,uint256 value)"
];

// ================= CONTRACT =================

const contract = new ethers.Contract(USDT_CONTRACT, ABI, provider);

console.log("🔥 Rebirth Deposit Scanner Started");
console.log("👀 Watching wallet:", WATCH_ADDRESS);

// ================= SETTINGS =================

const DECIMALS = 18;
let txPool = [];
let sentHashes = new Set();

// ================= FILTER =================

function isValidAmount(amount){

if(amount < 30) return false;

if(amount > 900) return false;

if(amount % 10 !== 0) return false;

return true;

}

// ================= LISTENER =================

contract.on("Transfer", async (from,to,value,event)=>{

try{

const amount = Number(
ethers.formatUnits(value,DECIMALS)
);

const toAddress = to.toLowerCase();

const hash = event.log.transactionHash;

if(sentHashes.has(hash)) return;

console.log("TX:",from,"→",toAddress,"Amount:",amount);

// ================= WALLET =================

if(toAddress === WATCH_ADDRESS){

console.log("✅ Deposit to WATCH_ADDRESS");

txPool.push({
from,
to,
amount,
hash
});

sentHashes.add(hash);

return;

}

// ================= CONTRACT =================

if(toAddress === USDT_CONTRACT.toLowerCase()){

if(!isValidAmount(amount)) return;

console.log("✅ Valid contract deposit");

txPool.push({
from,
to,
amount,
hash
});

sentHashes.add(hash);

}

}catch(err){

console.log("Listener Error:",err.message);

}

});

// ================= RANDOM =================

function randomInt(min,max){

return Math.floor(Math.random()*(max-min+1))+min;

}

// ================= SENDER LOOP =================

setInterval(async ()=>{

try{

if(txPool.length === 0){

console.log("⏳ No deposits found");

return;

}

// 2-4 transactions send

const sendCount = randomInt(2,4);

const shuffled = txPool.sort(()=>0.5-Math.random());

const selected = shuffled.slice(0,sendCount);

for(const tx of selected){

const message = `
🚀🔥 REBIRTH CHARITY – NEW DEPOSIT 🔥🚀
━━━━━━━━━━━━━━━━━━

💰 Amount: $${tx.amount} USDT

📤 From
${tx.from}

📥 To
${tx.to}

🔗 Transaction
https://bscscan.com/tx/${tx.hash}

━━━━━━━━━━━━━━━━━━
🎉 Successful Deposit Confirmed
`;

await bot.sendMessage(CHANNEL_ID,message);

console.log("📤 Sent:",tx.amount);

}

// clear pool
txPool = [];

}catch(err){

console.log("Send Error:",err.message);

}

},300000); // 5 minutes