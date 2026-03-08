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

// ================= PROVIDER =================

const provider = new ethers.JsonRpcProvider(RPC,{
staticNetwork:true
});

const bot = new TelegramBot(TELEGRAM_TOKEN,{ polling:false });

// ================= WALLET =================

const WATCH_ADDRESS =
"0xc8Bcf348A74018B11DCB52765Bd818E85FBE6A3f".toLowerCase();

// ================= USDT =================

const USDT =
"0x55d398326f99059ff775485246999027b3197955";

const ABI = [
"event Transfer(address indexed from,address indexed to,uint256 value)"
];

const contract = new ethers.Contract(USDT,ABI,provider);

const DECIMALS = 6;

let sent = new Set();

console.log("👀 Wallet watcher started");
console.log("Wallet:",WATCH_ADDRESS);

// ================= TELEGRAM =================

async function sendTelegram(tx){

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

}catch(err){

console.log("Telegram error:",err.message);

}

}

// ================= LOAD LAST 5 =================

async function loadLastTransactions(){

console.log("🔎 Loading last 5 wallet transactions...");

try{

const current = await provider.getBlockNumber();

// small range to avoid RPC rate limit
const fromBlock = current - 500;

const logs = await provider.getLogs({

address:USDT,
fromBlock:fromBlock,
toBlock:current,
topics:[ethers.id("Transfer(address,address,uint256)")]

});

let found = [];

for(const log of logs){

try{

const parsed = contract.interface.parseLog(log);

const from = parsed.args.from.toLowerCase();
const to = parsed.args.to.toLowerCase();

if(from !== WATCH_ADDRESS && to !== WATCH_ADDRESS) continue;

const amount = Number(
ethers.formatUnits(parsed.args.value,DECIMALS)
);

found.push({
hash:log.transactionHash,
from,
to,
amount
});

}catch(e){}

}

found = found.slice(-5);

for(const tx of found){

await sendTelegram(tx);
sent.add(tx.hash);

}

console.log("✅ Last transactions loaded");

}catch(err){

console.log("⚠ Past scan error:",err.message);

}

}

// ================= LIVE WATCH =================

function startListener(){

console.log("🎧 Live wallet monitoring started");

contract.on("Transfer",async(from,to,value,event)=>{

try{

const fromAddr = from.toLowerCase();
const toAddr = to.toLowerCase();

if(fromAddr !== WATCH_ADDRESS && toAddr !== WATCH_ADDRESS){
return;
}

const hash = event.log.transactionHash;

if(sent.has(hash)) return;

const amount = Number(
ethers.formatUnits(value,DECIMALS)
);

const tx = {
from,
to,
amount,
hash
};

await sendTelegram(tx);

sent.add(hash);

}catch(err){

console.log("Listener error:",err.message);

}

});

}

// ================= AUTO RECONNECT =================

provider.on("error",(err)=>{

console.log("⚠ RPC Error:",err.message);
console.log("Reconnecting listener...");

contract.removeAllListeners();
setTimeout(startListener,3000);

});

// ================= START =================

(async()=>{

await loadLastTransactions();

startListener();

})();