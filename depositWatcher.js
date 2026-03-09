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

// Purane sent hashes load karo taaki restart pe duplicate na bhejye
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
    const arr = [...sentHashes].slice(-2000); // Sirf last 2000 hashes rakho file heavy na ho
    fs.writeFileSync("sent_deposits.json", JSON.stringify(arr, null, 2));
}

// ================= FILTER =================
function isValidAmount(amount) {
    // $30, $60, $90, $120, $150 only
    return amount >= 30 && amount <= 150 && amount % 30 === 0;
}

// ================= STABLE SCANNER (Polling) =================
async function startStableScanner() {
    console.log("🔥 Rebirth Stable Deposit Scanner Started");
    
    try {
        lastCheckedBlock = await provider.getBlockNumber();
    } catch (e) {
        console.log("❌ Error getting block:", e.message);
        setTimeout(startStableScanner, 5000);
        return;
    }

    // Har 20 second mein check karega (Public RPC ke liye safe)
    setInterval(async () => {
        try {
            const currentBlock = await provider.getBlockNumber();
            if (currentBlock > lastCheckedBlock) {
                const fromBlock = lastCheckedBlock + 1;
                const toBlock = currentBlock;

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
                            console.log(`✅ Valid Deposit Found: ${amount} USDT`);
                            txQueue.push({
                                from: parsed.args.from,
                                to: parsed.args.to,
                                amount,
                                hash
                            });
                            saveHash(hash); // File mein turant save karo
                        }
                    } catch (e) {}
                }
                lastCheckedBlock = currentBlock;
            }
        } catch (err) {
            console.log("⚠️ Polling Error:", err.message);
        }
    }, 20000); 
}

// ================= RANDOM DELAY =================
function randomDelay() {
    const min = 2 * 60 * 1000; // 2 minute
    const max = 5 * 60 * 1000; // 5 minute
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ================= SENDER LOOP =================
async function senderLoop() {
    while (true) {
        try {
            if (txQueue.length === 0) {
                await new Promise(r => setTimeout(r, 5000));
                continue;
            }

            const tx = txQueue.shift(); // Pehle wala uthao

            const message = `
🚀🔥 <b>REBIRTH CHARITY – NEW DEPOSIT</b> 🔥🚀
━━━━━━━━━━━━━━━━━━

💰 <b>Amount:</b> $${tx.amount} USDT

📤 <b>From</b>
<code>${tx.from}</code>

📥 <b>To</b>
<code>${tx.to}</code>

🔗 <a href="https://bscscan.com/tx/${tx.hash}"><b>View Transaction on BscScan</b></a>

━━━━━━━━━━━━━━━━━━
🎉 Successful Deposit Confirmed
`;

            await bot.sendMessage(CHANNEL_ID, message, { parse_mode: "HTML" });
            console.log("📤 Message Sent to Telegram:", tx.amount);

            // 2 se 5 minute ka random gap
            const wait = randomDelay();
            console.log(`💤 Waiting ${Math.floor(wait/1000)}s for next message...`);
            await new Promise(r => setTimeout(r, wait));

        } catch (err) {
            console.log("❌ Send Error:", err.message);
            await new Promise(r => setTimeout(r, 10000)); // Error pe 10s ruko
        }
    }
}

// ================= ERROR HANDLING =================
process.on("uncaughtException", (err) => console.log("Uncaught:", err.message));
process.on("unhandledRejection", (err) => console.log("Unhandled:", err?.message || err));

// ================= START =================
startStableScanner();
senderLoop();