require("dotenv").config();

const { ethers } = require("ethers");
const TelegramBot = require("node-telegram-bot-api");

// ================= ENV =================

const RPC = process.env.RPC;
const TELEGRAM_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = process.env.CHAT_ID;

if (!RPC || !TELEGRAM_TOKEN || !CHANNEL_ID) {
console.log("❌ Missing ENV values");
process.exit(1);
}

// ================= ADDRESSES =================

const WATCH_ADDRESS =
"0xc8Bcf348A74018B11DCB52765Bd818E85FBE6A3f".toLowerCase();

const USDT_CONTRACT =
"0x55d398326f99059ff775485246999027b3197955";

// ================= PROVIDER =================

const provider = new ethers.JsonRpcProvider(RPC);

provider.pollingInterval = 4000;

// ================= TELEGRAM =================

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling:false });

// ================= ABI =================

const ABI = [
"event Transfer(address indexed from,address indexed to,uint256 value)"
];

// ================= CONTRACT =================

const contract = new ethers.Contract(
USDT_CONTRACT,
ABI,
provider
);

console.log("🔥 Rebirth Deposit Scanner Started");
console.log("👀 Watching:",WATCH_ADDRESS);

// ================= SETTINGS =================

const DECIMALS = 18;

let txQueue = [];

let sentHashes = new Set();

// ================= FILTER =================

function isValidAmount(amount){

if(!isValidAmount(amount)) return;


if(amount < 30) return false;

if(amount > 150) return false;

if(amount % 30 !== 0) return false;

return true;

}

// ================= LISTENER =================

function startListener(){

console.log("🎧 Listener started");

contract.on("Transfer",async(from,to,value,event)=>{

try{

const amount = Number(
ethers.formatUnits(value,DECIMALS)
);

const toAddress = to.toLowerCase();

const hash = event.log.transactionHash;

if(sentHashes.has(hash)) return;

console.log(
"TX:",from,"→",toAddress,"Amount:",amount
);

// WATCH WALLET

if(toAddress === WATCH_ADDRESS){

console.log("✅ Deposit to WATCH WALLET");

txQueue.push({
from,
to,
amount,
hash
});

sentHashes.add(hash);

return;

}

// GLOBAL VALID TRANSFERS

if(isValidAmount(amount)){

console.log("✅ Valid USDT detected");

txQueue.push({
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

}

// ================= AUTO RESTART =================

provider.on("error",(err)=>{

console.log("⚠ Provider error:",err.message);

if(err.message.includes("filter not found")){

console.log("🔄 Restarting listener");

contract.removeAllListeners();

startListener();

}

});

// ================= RANDOM =================

function randomDelay(){

const min = 2 * 60 * 1000; // 2 minutes
const max = 5 * 60 * 1000; // 5 minutes

return Math.floor(Math.random() * (max - min + 1)) + min;

}

// ================= SEND LOOP =================

async function senderLoop(){

while(true){

try{

if(txQueue.length === 0){

await new Promise(r=>setTimeout(r,4000));

continue;

}

const tx = txQueue.shift();

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

await new Promise(r=>setTimeout(r,randomDelay()));

}catch(err){

console.log("Send Error:",err.message);

}

}

}

// ================= START =================

startListener();

senderLoop();