require("dotenv").config();
const { ethers } = require("ethers");
const TelegramBot = require("node-telegram-bot-api");

// ================= ENV =================
const RPC = process.env.RPC; // https://bsc-dataseed.binance.org/
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

let txQueue = [];
let sentHashes = new Set();
let lastCheckedBlock = 0;

console.log("🔥 Rebirth Stable Deposit Scanner Started");

// ================= VALIDATION =================
function isValidAmount(amount) {
    if (amount < 30 || amount > 150 || amount % 30 !== 0) return false;
    return true;
}

// ================= STABLE POLLING LISTENER =================
// Yeh function "filter not found" error ko jad se khatam kar dega
async function startStableListener() {
    console.log("🎧 Live Listener Started (Stable Polling Mode)");

    try {
        // Shuruat mein current block le lo
        lastCheckedBlock = await provider.getBlockNumber();
        console.log(`📡 Starting from block: ${lastCheckedBlock}`);
    } catch (err) {
        console.log("❌ Initial Block Error:", err.message);
        setTimeout(startStableListener, 5000);
        return;
    }

    // Har 12 second mein naye blocks scan karo (BSC block time ~3s hota hai)
    setInterval(async () => {
        try {
            const currentBlock = await provider.getBlockNumber();

            if (currentBlock > lastCheckedBlock) {
                // Sirf naye blocks ka data uthao
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
                            console.log(`✅ Valid Deposit: ${amount} USDT | Hash: ${hash.substring(0, 10)}...`);
                            
                            txQueue.push({
                                from: parsed.args.from,
                                to: parsed.args.to,
                                amount,
                                hash
                            });

                            sentHashes.add(hash);
                        }
                    } catch (e) {
                        // Skip if parse fails
                    }
                }
                lastCheckedBlock = currentBlock; // Update block counter
            }
        } catch (err) {
            console.log("⚠️ RPC Polling Error (Retrying...):", err.message);
            // Agar RPC fail ho jaye toh koi tension nahi, agla interval pichle blocks cover kar lega
        }
    }, 12000); 
}

// ================= RANDOM DELAY =================
function randomDelay() {
    const min = 2 * 60 * 1000;
    const max = 5 * 60 * 1000;
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ================= SENDER LOOP =================
async function senderLoop() {
    while (true) {
        try {
            if (txQueue.length === 0) {
                await new Promise(r => setTimeout(r, 4000));
                continue;
            }

            const tx = txQueue.shift();

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

            // Wait for random delay to avoid spamming
            await new Promise(r => setTimeout(r, randomDelay()));

        } catch (err) {
            console.log("❌ Send Error:", err.message);
        }
    }
}

// ================= ERROR HANDLERS =================
process.on("uncaughtException", (err) => console.log("Uncaught Exception:", err.message));
process.on("unhandledRejection", (err) => console.log("Unhandled Rejection:", err?.message || err));

// ================= EXECUTE =================
startStableListener();
senderLoop();