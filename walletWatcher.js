require("dotenv").config();

const { ethers } = require("ethers");
const TelegramBot = require("node-telegram-bot-api");

// ================= ENV =================

const RPC1 = process.env.RPC_WALLET;
const RPC2 = process.env.RPC_BACKUP;

const TELEGRAM_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = process.env.CHAT_ID;

if (!RPC1 || !TELEGRAM_TOKEN || !CHANNEL_ID) {
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

// ================= PROVIDER =================

let provider;

function createProvider(rpc){

const ws = new ethers.WebSocketProvider(rpc);

ws.on("error",(err)=>{
console.log("⚠ WebSocket error:",err.message);
});

ws.on("close",()=>{
console.log("⚠ WebSocket closed, reconnecting...");
setTimeout(startProvider,3000);
});

return ws;

}

function startProvider(){

console.log("🔌 Connecting RPC...");

try{

provider = createProvider(RPC1);

}catch(e){

console.log("⚠ Main RPC failed, using backup");

provider = createProvider(RPC2);

}

startBot();

}

// ================= TELEGRAM =================

const bot = new TelegramBot(TELEGRAM_TOKEN,{ polling:false });

// ================= ABI =================

const ABI = [
"event Transfer(address indexed from,address indexed to,uint256 value)"
];

// ================= MEMORY =================

let sent = new Set();

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

// ================= CONTRACT =================

let contract;

function startBot(){

contract = new ethers.Contract(
USDT,
ABI,
provider
);

console.log("👀 Wallet watcher started");
console.log("Watching:",WATCH);

loadLast5();

startListener();

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

address: USDT,
fromBlock,
toBlock: currentBlock,
topics:[
transferTopic,
null,
ethers.zeroPadValue(WATCH,32)
]

});

let found = 0;

for(let i = logs.length-1;i>=0;i--){

if(found >=5) break;

const log = logs[i];

const parsed = contract.interface.parseLog(log);

const amount = Number(
ethers.formatUnits(parsed.args.value,DECIMALS)
);

if(amount < MIN_AMOUNT) continue;

const hash = log.transactionHash;

if(sent.has(hash)) continue;

await send({
from: parsed.args.from,
to: parsed.args.to,
amount,
hash
});

sent.add(hash);

found++;

}

console.log("✅ Last deposits:",found);

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

// ================= START =================

startProvider();

// keep process alive

setInterval(()=>{},1000);