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

// ================= PROVIDER =================

const provider = new ethers.JsonRpcProvider(RPC);

provider.polling = true;
provider.pollingInterval = 4000;

// ================= TELEGRAM =================

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });

// ================= WATCH WALLET =================

const WATCH =
"0xc8bcf348a74018b11dcb52765bd818e85fbe6a3f".toLowerCase();

// ================= USDT =================

const USDT =
"0x55d398326f99059ff775485246999027b3197955";

const DECIMALS = 18;
const MIN_AMOUNT = 1;

// ================= ABI =================

const ABI = [
"event Transfer(address indexed from,address indexed to,uint256 value)"
];

const contract = new ethers.Contract(
USDT,
ABI,
provider
);

// ================= MEMORY =================

let sent = new Set();

console.log("👀 Wallet watcher started");
console.log("Watching:", WATCH);

// ================= TELEGRAM =================

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

const fromBlock = currentBlock - 500;

const transferTopic =
ethers.id("Transfer(address,address,uint256)");

const logs = await provider.getLogs({

address: USDT,
fromBlock: fromBlock,
toBlock: currentBlock,
topics: [transferTopic]

});

let found = 0;

for(let i = logs.length - 1; i >= 0; i--){

if(found >= 5) break;

const log = logs[i];

const parsed = contract.interface.parseLog(log);

const from = parsed.args.from;
const to = parsed.args.to;

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

// ================= LIVE LISTENER =================

function startListener(){

console.log("🎧 Live listener started");

contract.removeAllListeners();

contract.on("Transfer", async (from,to,value,event)=>{

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

// memory clean
if(sent.size > 500){
sent.clear();
}

}catch(err){

console.log("Listener error:",err.message);

}

});

}

// ================= AUTO RECOVERY =================

provider.on("error",(err)=>{

console.log("⚠ Provider error:",err.message);

restart();

});

// ================= RESTART =================

let restarting = false;

function restart(){

if(restarting) return;

restarting = true;

console.log("🔄 Restarting listener...");

setTimeout(()=>{

startListener();

restarting = false;

},3000);

}

// ================= HEARTBEAT =================

setInterval(async ()=>{

try{

await provider.getBlockNumber();

}catch(e){

console.log("⚠ RPC heartbeat failed");

restart();

}

},20000);

// ================= START =================

(async()=>{

await loadLast5();

startListener();

})();