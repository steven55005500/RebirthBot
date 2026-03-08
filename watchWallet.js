require("dotenv").config();

const { ethers } = require("ethers");
const TelegramBot = require("node-telegram-bot-api");

// ENV
const RPC = process.env.RPC_WALLET;
const TELEGRAM_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = process.env.CHAT_ID;

if(!RPC || !TELEGRAM_TOKEN || !CHANNEL_ID){
console.log("❌ Missing ENV values");
process.exit(1);
}

const provider = new ethers.JsonRpcProvider(RPC);
const bot = new TelegramBot(TELEGRAM_TOKEN,{polling:false});

// WATCH ADDRESS
const WATCH =
"0xc8bcf348a74018b11dcb52765bd818e85fbe6a3f".toLowerCase();

// USDT
const USDT =
"0x55d398326f99059ff775485246999027b3197955";

const DECIMALS = 18;

let lastBlock = 0;
let sent = new Set();

console.log("👀 Wallet watcher started");
console.log("Wallet:",WATCH);

// TELEGRAM
async function send(tx){

const msg = `
🚀🔥 REBIRTH CHARITY – NEW DEPOSIT 🔥🚀
━━━━━━━━━━━━━━━━━━

💰 Amount: $${tx.amount} USDT

📤 From
${tx.from}

📥 To
${tx.to}

🔗 https://bscscan.com/tx/${tx.hash}

━━━━━━━━━━━━━━━━━━
`;

try{
await bot.sendMessage(CHANNEL_ID,msg);
console.log("📤 Sent:",tx.amount);
}catch(e){
console.log("Telegram error:",e.message);
}

}

// BLOCK SCANNER
async function scan(){

try{

const current = await provider.getBlockNumber();

// FIRST START → scan last 20 blocks
if(lastBlock === 0){
lastBlock = current - 20;
}

for(let i = lastBlock + 1; i <= current; i++){

const block = await provider.getBlock(i,true);

for(const tx of block.transactions){

if(!tx.to) continue;

const receipt = await provider.getTransactionReceipt(tx.hash);

for(const log of receipt.logs){

if(log.address.toLowerCase() !== USDT) continue;

if(log.topics[0] !==
ethers.id("Transfer(address,address,uint256)"))
continue;

const from = "0x"+log.topics[1].slice(26);
const to = "0x"+log.topics[2].slice(26);

if(
from.toLowerCase() !== WATCH &&
to.toLowerCase() !== WATCH
) continue;

if(sent.has(tx.hash)) continue;

const value = ethers.getBigInt(log.data);

const amount =
Number(ethers.formatUnits(value,DECIMALS));

await send({
from,
to,
amount,
hash:tx.hash
});

sent.add(tx.hash);

if(sent.size > 5000){
sent.clear();
}

}

}

}

lastBlock = current;

}catch(err){

console.log("scan error:",err.message);

}

}

// LOOP
setInterval(scan,4000);