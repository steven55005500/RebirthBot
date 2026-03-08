require("dotenv").config();

const { ethers } = require("ethers");
const TelegramBot = require("node-telegram-bot-api");

// ================= ENV =================

const RPC = process.env.RPC_WALLET;
const TELEGRAM_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = process.env.CHAT_ID;

if (!RPC || !TELEGRAM_TOKEN || !CHANNEL_ID) {
console.log("❌ Missing ENV values");
process.exit(1);
}

// ================= SETTINGS =================

const WATCH =
"0xc8bcf348a74018b11dcb52765bd818e85fbe6a3f".toLowerCase();

const USDT =
"0x55d398326f99059ff775485246999027b3197955";

const DECIMALS = 18;
const MIN_AMOUNT = 1;

// ================= TELEGRAM =================

const bot = new TelegramBot(TELEGRAM_TOKEN,{ polling:false });

// ================= ABI =================

const ABI = [
"event Transfer(address indexed from,address indexed to,uint256 value)"
];

// ================= VARIABLES =================

let provider;
let contract;
let reconnecting = false;

let sent = new Set();

// ================= PROVIDER INIT =================

function createProvider(){

provider = new ethers.JsonRpcProvider(RPC);

provider.polling = true;
provider.pollingInterval = 7000;

attachProviderEvents();

contract = new ethers.Contract(
USDT,
ABI,
provider
);

}

// ================= PROVIDER EVENTS =================

function attachProviderEvents(){

provider.on("error",(err)=>{

console.log("⚠ Provider error:",err.message);

if(reconnecting) return;

if(
err.message.includes("filter") ||
err.message.includes("timeout") ||
err.message.includes("connection")
){

reconnecting = true;

console.log("🔄 Reconnecting RPC...");

setTimeout(async()=>{

await reconnect();

reconnecting = false;

},8000);

}

});

}

// ================= RECONNECT =================

async function reconnect(){

console.log("🔁 Creating new provider...");

createProvider();

startListener();

}

// ================= TELEGRAM SEND =================

async function send(tx){

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

try{

await bot.sendMessage(CHANNEL_ID,message);

console.log("📤 Sent:",tx.amount);

}catch(e){

console.log("Telegram error:",e.message);

}

}

// ================= LAST SCAN =================

async function loadLast5(){

console.log("📦 Loading last deposits...");

try{

const currentBlock = await provider.getBlockNumber();

const fromBlock = currentBlock - 120;

const transferTopic =
ethers.id("Transfer(address,address,uint256)");

const logs = await provider.getLogs({

address:USDT,
fromBlock:fromBlock,
toBlock:currentBlock,
topics:[transferTopic]

});

let found = 0;

for(let i = logs.length - 1; i >= 0; i--){

if(found >= 5) break;

const log = logs[i];

const parsed = contract.interface.parseLog(log);

const from = parsed.args.from;
const to = parsed.args.to;

if(!to) continue;

if(to.toLowerCase() !== WATCH) continue;

const amount = Number(
ethers.formatUnits(parsed.args.value,DECIMALS)
);

if(amount < MIN_AMOUNT) continue;

const hash = log.transactionHash;

if(sent.has(hash)) continue;

await send({
from,
to,
amount,
hash
});

sent.add(hash);

found++;

}

console.log("✅ Last deposits sent");

}catch(err){

console.log("Past scan error:",err.message);

}

}

// ================= LISTENER =================

function startListener(){

console.log("🎧 Live listener started");

contract.removeAllListeners();

contract.on("Transfer",async(from,to,value,event)=>{

try{

if(!to) return;

if(to.toLowerCase() !== WATCH) return;

const amount = Number(
ethers.formatUnits(value,DECIMALS)
);

if(amount < MIN_AMOUNT) return;

const hash = event.log.transactionHash;

if(sent.has(hash)) return;

console.log("💰 Deposit detected:",amount);

await send({
from,
to,
amount,
hash
});

sent.add(hash);

if(sent.size > 1000){
sent.clear();
}

}catch(err){

console.log("Listener error:",err.message);

}

});

}

// ================= HEARTBEAT =================

setInterval(async()=>{

try{

await provider.getBlockNumber();

}catch(e){

console.log("⚠ RPC heartbeat failed");

if(!reconnecting){

reconnecting = true;

console.log("🔄 Reconnecting RPC...");

setTimeout(async()=>{

await reconnect();

reconnecting = false;

},8000);

}

}

},30000);

// ================= START =================

(async()=>{

console.log("👀 Wallet watcher started");
console.log("Watching:",WATCH);

createProvider();

await loadLast5();

startListener();

})();