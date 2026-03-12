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

// ================= CONTRACT =================

const USDT_CONTRACT =
"0x55d398326f99059ff775485246999027b3197955";

// ================= PROVIDER =================

let provider = new ethers.JsonRpcProvider(RPC);
provider.pollingInterval = 4000;

// ================= TELEGRAM =================

const bot = new TelegramBot(TELEGRAM_TOKEN,{ polling:false });

// ================= ABI =================

const ABI = [
"event Transfer(address indexed from,address indexed to,uint256 value)"
];

// ================= CONTRACT =================

let contract = new ethers.Contract(
USDT_CONTRACT,
ABI,
provider
);

console.log("🔥 Rebirth Deposit Scanner Started");

// ================= SETTINGS =================

const DECIMALS = 18;

let txQueue = [];
let sentHashes = new Set();
let listenerStarted = false;

// ================= FILTER =================

function isValidAmount(amount){

if(amount < 30) return false;
if(amount > 150) return false;
if(amount % 30 !== 0) return false;

return true;

}

// ================= PAST SCAN =================

async function scanPastDeposits(){

console.log("🔎 Scanning last 15 minutes deposits...");

try{

const currentBlock = await provider.getBlockNumber();
const fromBlock = currentBlock - 300;

const transferTopic = ethers.id(
"Transfer(address,address,uint256)"
);

const logs = await provider.getLogs({
address: USDT_CONTRACT,
fromBlock: fromBlock,
toBlock: currentBlock,
topics: [transferTopic]
});

for(const log of logs){

try{

const parsed = contract.interface.parseLog(log);

const from = parsed.args.from;
const to = parsed.args.to;

const amount = Number(
ethers.formatUnits(parsed.args.value,DECIMALS)
);

const hash = log.transactionHash;

if(sentHashes.has(hash)) continue;

if(isValidAmount(amount)){

console.log("📦 Past Valid Deposit:",amount);

txQueue.push({
from,
to,
amount,
hash
});

sentHashes.add(hash);

}

}catch(e){
console.log("Parse error:",e.message);
}

}

console.log("✅ Past scan completed");

}catch(err){

console.log("Past scan error:",err.message);

}

}

// ================= LISTENER =================

function startListener(){

if(listenerStarted) return;

listenerStarted = true;

console.log("🎧 Listener started");

contract.on("Transfer",async(from,to,value,event)=>{

try{

const amount = Number(
ethers.formatUnits(value,DECIMALS)
);

const hash = event.log.transactionHash;

if(sentHashes.has(hash)) return;

console.log(
"TX:",from,"→",to,"Amount:",amount
);

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

// ================= RECONNECT SYSTEM =================

async function restartListener(){

try{

console.log("🔄 Restarting listener...");

contract.removeAllListeners();

provider = new ethers.JsonRpcProvider(RPC);
provider.pollingInterval = 4000;

contract = new ethers.Contract(
USDT_CONTRACT,
ABI,
provider
);

listenerStarted = false;

startListener();

}catch(e){

console.log("Restart failed:",e.message);

}

}

// ================= PROVIDER ERROR =================

provider.on("error",(err)=>{

console.log("⚠ Provider error:",err.message);

restartListener();

});

// ================= RANDOM DELAY =================

function randomDelay(){

const min = 1 * 60 * 1000;
const max = 2 * 60 * 1000;

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

(async () => {

await scanPastDeposits();

startListener();

senderLoop();

})();