require("dotenv").config();
const { ethers } = require("ethers");
const TelegramBot = require("node-telegram-bot-api");

// ================= ENV =================
const RPC = process.env.RPC; 
const TELEGRAM_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = process.env.CHAT_ID;

const provider = new ethers.JsonRpcProvider(RPC);
const USDT_CONTRACT = "0x55d398326f99059ff775485246999027b3197955";
const DECIMALS = 18;

const ABI = ["event Transfer(address indexed from,address indexed to,uint256 value)"];
const contract = new ethers.Contract(USDT_CONTRACT, ABI, provider);
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });

let txQueue = [];
let sentHashes = new Set();
let lastCheckedBlock = 0;

console.log("🔥 Rebirth Stable Deposit Scanner Started");

function isValidAmount(amount) {
    return amount >= 30 && amount <= 150 && amount % 30 === 0;
}

// ================= STABLE POLLING (Optimized for Public RPC) =================

async function startStableListener() {
    console.log("🎧 Live Listener Started (Anti-Rate-Limit Mode)");

    try {
        lastCheckedBlock = await provider.getBlockNumber();
        console.log(`📡 Initial block: ${lastCheckedBlock}`);
    } catch (err) {
        console.log("❌ Block Error:", err.message);
        setTimeout(startStableListener, 10000);
        return;
    }

    // Interval badha kar 30 second kar diya taaki Binance block na kare
    setInterval(async () => {
        try {
            const currentBlock = await provider.getBlockNumber();

            if (currentBlock > lastCheckedBlock) {
                // Ek saath sirf 5 blocks scan karenge (Rate limit se bachne ke liye)
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
                            sentHashes.add(hash);
                        }
                    } catch (e) {}
                }
                lastCheckedBlock = toBlock; 
            }
        } catch (err) {
            // Agar rate limit hit ho jaye toh shanti se agle round ka wait karo
            if (err.message.includes("rate limit")) {
                console.log("⚠️ Rate limit hit. Waiting for next cycle...");
            } else {
                console.log("⚠️ Polling Error:", err.message);
            }
        }
    }, 30000); // 30 seconds gap
}

// ================= RANDOM DELAY SENDER =================

async function senderLoop() {
    while (true) {
        try {
            if (txQueue.length === 0) {
                await new Promise(r => setTimeout(r, 5000));
                continue;
            }

            const tx = txQueue.shift();
            const message = `
🚀🔥 <b>REBIRTH CHARITY – NEW DEPOSIT</b> 🔥🚀
━━━━━━━━━━━━━━━━━━
💰 <b>Amount:</b> $${tx.amount} USDT
📤 <b>From:</b> <code>${tx.from}</code>
📥 <b>To:</b> <code>${tx.to}</code>
🔗 <a href="https://bscscan.com/tx/${tx.hash}"><b>View on BscScan</b></a>
━━━━━━━━━━━━━━━━━━
🎉 Successful Deposit Confirmed
`;

            await bot.sendMessage(CHANNEL_ID, message, { parse_mode: "HTML" });
            console.log("📤 Message Sent:", tx.amount);

            // 2-5 min random delay
            const delay = Math.floor(Math.random() * (300000 - 120000 + 1)) + 120000;
            await new Promise(r => setTimeout(r, delay));

        } catch (err) {
            console.log("❌ Send Error:", err.message);
        }
    }
}

process.on("uncaughtException", (err) => console.log("Uncaught:", err.message));
process.on("unhandledRejection", (err) => console.log("Unhandled:", err?.message || err));

startStableListener();
senderLoop();