require("dotenv").config();
const { ethers } = require("ethers");
const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");

// ================= ENV =================
const RPC = process.env.RPC;
const TELEGRAM_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = process.env.CHAT_ID;

if (!RPC || !TELEGRAM_TOKEN || !CHANNEL_ID) {
    console.log("❌ Missing ENV values");
    process.exit(1);
}

// ================= CONFIG =================
const USDT_CONTRACT = "0x55d398326f99059ff775485246999027b3197955";
const DECIMALS = 18;
const provider = new ethers.JsonRpcProvider(RPC);
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });
const ABI = ["event Transfer(address indexed from,address indexed to,uint256 value)"];
const contract = new ethers.Contract(USDT_CONTRACT, ABI, provider);

// ================= STORAGE LOGIC =================
let txQueue = [];
let sentHashes = new Set();
let lastCheckedBlock = 0;

if (fs.existsSync("sent_deposits.json")) {
    try {
        const data = JSON.parse(fs.readFileSync("sent_deposits.json", "utf8"));
        sentHashes = new Set(data);
        console.log(`✅ Loaded ${sentHashes.size} previous hashes`);
    } catch (e) {
        sentHashes = new Set();
    }
}

function saveHash(hash) {
    sentHashes.add(hash);
    const arr = [...sentHashes].slice(-1000); 
    fs.writeFileSync("sent_deposits.json", JSON.stringify(arr, null, 2));
}

function isValidAmount(amount) {
    return amount >= 30 && amount <= 150 && amount % 30 === 0;
}

// ================= ANTI-RATE-LIMIT SCANNER =================
async function startStableScanner() {
    console.log("🔥 Rebirth Anti-Rate-Limit Scanner Started");
    
    try {
        lastCheckedBlock = await provider.getBlockNumber();
        console.log(`📡 Starting from block: ${lastCheckedBlock}`);
    } catch (e) {
        console.log("❌ Block Error, Retrying...");
        setTimeout(startStableScanner, 10000);
        return;
    }

    // Interval badha kar 40 second kar diya hai (Ekdum safe)
    setInterval(async () => {
        try {
            const currentBlock = await provider.getBlockNumber();
            if (currentBlock > lastCheckedBlock) {
                
                // 🚨 LIMIT: Ek baar mein sirf 5 blocks hi scan honge
                const toBlock = Math.min(currentBlock, lastCheckedBlock + 5);
                const fromBlock = lastCheckedBlock + 1;

                console.log(`🔎 Scanning: ${fromBlock} to ${toBlock}`);

                const logs = await provider.getLogs({
                    address: USDT_CONTRACT,
                    fromBlock: fromBlock,
                    toBlock: toBlock,
                    topics: [ethers.id("Transfer(address,address,uint256)")]
                });

                for (const log of logs) {
                    try {
                        const parsed = contract.interface.parseLog(log);
                        const amount = Number(ethers.formatUnits(parsed.args.value, DECIMALS));
                        const hash = log.transactionHash;

                        if (!sentHashes.has(hash) && isValidAmount(amount)) {
                            console.log(`✅ Valid Deposit: ${amount} USDT`);
                            txQueue.push({ from: parsed.args.from, to: parsed.args.to, amount, hash });
                            saveHash(hash);
                        }
                    } catch (e) {}
                }
                lastCheckedBlock = toBlock;
            }
        } catch (err) {
            // Agar Binance block kare, toh agle 40s tak shanti se ruko
            console.log("⚠️ RPC Busy... Waiting for next cycle");
        }
    }, 40000); 
}

// ================= SENDER LOOP (Steady Delivery) =================
async function senderLoop() {
    while (true) {
        try {
            if (txQueue.length === 0) {
                await new Promise(r => setTimeout(r, 5000));
                continue;
            }

            const tx = txQueue.shift();
            const message = `🚀🔥 <b>REBIRTH CHARITY – NEW DEPOSIT</b> 🔥🚀\n━━━━━━━━━━━━━━━━━━\n💰 <b>Amount:</b> $${tx.amount} USDT\n📤 <b>From:</b> <code>${tx.from}</code>\n📥 <b>To:</b> <code>${tx.to}</code>\n🔗 <a href="https://bscscan.com/tx/${tx.hash}"><b>BscScan Link</b></a>\n━━━━━━━━━━━━━━━━━━\n🎉 Successful Deposit Confirmed`;

            await bot.sendMessage(CHANNEL_ID, message, { parse_mode: "HTML" });
            console.log("📤 Message Sent:", tx.amount);

            // 2-5 min random gap taaki Telegram spam na ho
            const wait = Math.floor(Math.random() * (300000 - 120000 + 1)) + 120000;
            console.log(`💤 Next message in ${Math.floor(wait/1000)}s`);
            await new Promise(r => setTimeout(r, wait));

        } catch (err) {
            console.log("❌ Send Error:", err.message);
            await new Promise(r => setTimeout(r, 15000));
        }
    }
}

process.on("uncaughtException", (err) => console.log("Uncaught:", err.message));
process.on("unhandledRejection", (err) => console.log("Unhandled:", err?.message || err));

startStableScanner();
senderLoop();