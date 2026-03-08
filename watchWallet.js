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

const provider = new ethers.JsonRpcProvider(RPC);

provider.polling = true;
provider.pollingInterval = 4000;
provider._maxInternalBlockNumber = -1;

// ================= TELEGRAM =================

const bot = new TelegramBot(TELEGRAM_TOKEN,{ polling:false });

// ================= WALLET =================

const WATCH_ADDRESS =
"0xc8bcf348a74018b11dcb52765bd818e85fbe6a3f".toLowerCase();

// ================= USDT =================

const USDT =
"0x55d398326f99059ff775485246999027b3197955";

const ABI = [
"event Transfer(address indexed from,address indexed to,uint256 value)"
];

const contract = new ethers.Contract(USDT,ABI,provider);

const DECIMALS = 18;

// ================= MEMORY =================

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

// ================= LISTENER =================

function startListener(){

contract.removeAllListeners();

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

// limit memory
if(sent.size > 5000){
sent = new Set([...sent].slice(-3000));
}

}catch(err){

console.log("Listener error:",err.message);

}

});

}

// ================= AUTO RECONNECT =================

provider.on("error",(err)=>{

console.log("⚠ RPC reconnecting...");

try{
contract.removeAllListeners();
}catch(e){}

setTimeout(()=>{
startListener();
},5000);

});

// ================= GLOBAL ERROR =================

process.on("uncaughtException",(err)=>{
console.log("Uncaught Error:",err.message);
});

process.on("unhandledRejection",(err)=>{
console.log("Unhandled Promise:",err);
});

// ================= START =================

startListener();