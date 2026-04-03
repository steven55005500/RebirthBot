require("dotenv").config();
const { ethers } = require("ethers");
const TelegramBot = require("node-telegram-bot-api");

const RPC1 = process.env.RPC_WALLET;
const TELEGRAM_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = process.env.CHAT_ID;

if (!RPC1 || !TELEGRAM_TOKEN || !CHANNEL_ID) {
  console.log("❌ Missing ENV values");
  process.exit(1);
}

const USDT = "0x55d398326f99059ff775485246999027b3197955";
const DECIMALS = 18;

// Limits & Timing
let txQueue = []; 
let hourlyTracker = []; 
const MAX_PER_HOUR = 5;

let provider;
let contract;
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });
const ABI = ["event Transfer(address indexed from, address indexed to, uint256 value)"];
let sent = new Set();

// ================= PROVIDER LOGIC =================
async function startProvider() {
  console.log("🔌 Connecting to RPC via HTTP...");
  try {
    if (provider) {
      provider.removeAllListeners();
    }

    provider = new ethers.JsonRpcProvider(RPC1);
    
    // --- YE ADD KAREIN ---
    provider.on("error", (err) => {
      console.log("🚨 Provider Error! Restarting...", err.message);
      setTimeout(startProvider, 5000);
    });
    // ---------------------

    provider.pollingInterval = 4000;
    await provider.getNetwork();
    console.log("✅ Network Ready!");
    startBot();
  } catch (err) {
    console.log("❌ Connection Error:", err.message, "Retrying...");
    setTimeout(startProvider, 5000);
  }
}

// ================= VALIDATION =================
// ================= VALIDATION (UPDATED AMOUNTS) =================
// ================= VALIDATION (ALL AMOUNTS) =================
  // Purane amounts (9, 18, 27, 36, 45, 54) 
  // + Naye amounts (7.2, 14.4, 28.8, 57.6)
 // ================= VALIDATION (STRICT AMOUNTS) =================
function isValidTransaction(amount) {
  // Purane amounts (9, 18, 27, 36, 45, 54) 
  // + Naye amounts (7.2, 14.4, 28.8, 57.6)
  const allowed = [9, 18, 27, 36, 45, 54, 7.2, 14.4, 28.8, 57.6]; 
  
  // EXACT MATCH: Sirf aur sirf list wale amounts hi allow honge
  const isMatched = allowed.includes(amount);

  if (!isMatched) return false;

  const now = Date.now();
  // Filter records older than 1 hour
  hourlyTracker = hourlyTracker.filter(time => now - time < 3600000);

  // If 5 messages already sent in this hour, skip it
  if (hourlyTracker.length >= MAX_PER_HOUR) {
    console.log(`⚠️ Limit Full. Skipping: ${amount} USDT`);
    return false;
  }

  return true;
}

// ================= SENDER LOOP (DRIP FEED) =================
async function senderLoop() {
  if (global.isLoopRunning) return;
  global.isLoopRunning = true;

  while (true) {
    if (txQueue.length > 0) {
      const tx = txQueue.shift();

      const message = `
🚀 REBIRTH CHARITY – WITHDRAWAL PROCESSED
━━━━━━━━━━━━━━━━━━
💰 Amount: $${tx.amount} USDT

📤 From
${tx.from}

📥 To
${tx.to}

🔗 Transaction
https://bscscan.com/tx/${tx.hash}

━━━━━━━━━━━━━━━━━━
✅ Withdrawal Completed Successfully
`;

      try {
        await bot.sendMessage(CHANNEL_ID, message);
        console.log(`📤 Sent: ${tx.amount} USDT. Waiting for next drip...`);

        // 10-15 min random delay
        const min = 10 * 60 * 1000;
        const max = 15 * 60 * 1000;
        const delay = Math.floor(Math.random() * (max - min + 1)) + min;
        await new Promise(r => setTimeout(r, delay));

      } catch (e) {
        console.log("Telegram error:", e.message);
      }

    } else {
      await new Promise(r => setTimeout(r, 10000));
    }
  }
}

// ================= BOT INIT =================
function startBot() {
  contract = new ethers.Contract(USDT, ABI, provider);
  console.log("🚀 Scanner Active");
  startListener();
  senderLoop();
}

// ================= LISTENER =================
function startListener() {
  if (!contract) return;
  
  // Purane listeners remove karo taaki duplicate alerts na aayein
  contract.removeAllListeners();
  console.log("👂 Listening for USDT Transfers...");

  contract.on("Transfer", async (from, to, value, event) => {
    try {
      const amount = Number(ethers.formatUnits(value, DECIMALS));
      const hash = event.log.transactionHash;

      if (sent.has(hash)) return;

      if (isValidTransaction(amount)) {
        console.log(`📦 Matched & Queued: ${amount} USDT`);
        sent.add(hash);
        hourlyTracker.push(Date.now());
        txQueue.push({ from, to, amount, hash });
      }

      if (sent.size > 2000) sent.clear();

    } catch (err) {
      console.log("⚠️ Listener Data Error:", err.message);
      // Agar 'from block not found' jaisa error aaye toh restart provider
      if (err.message.includes("block") || err.message.includes("filter")) {
        startProvider();
      }
    }
  });

  // 🔄 AUTO-REFRESH JUGAD: Har 15 minute mein listener refresh karein
  // Isse 'from block not found' wala error aane ke chances 90% kam ho jayenge
  if (global.refreshTimeout) clearTimeout(global.refreshTimeout);
  global.refreshTimeout = setTimeout(() => {
    console.log("♻️ Periodic Listener Refresh to keep connection alive...");
    startListener();
  }, 15 * 60 * 1000); 
}

// ================= BOT INIT =================
function startBot() {
  // Contract initialize karein agar nahi hai
  contract = new ethers.Contract(USDT, ABI, provider);
  console.log("🚀 Scanner Active");
  
  startListener();
  
  // Sender loop sirf ek baar chalna chahiye
  if (!global.isLoopRunning) {
    senderLoop();
  }
}

// ================= ERROR PROTECTION =================
process.on("uncaughtException", (err) => console.log("System Error:", err.message));
process.on("unhandledRejection", (err) => console.log("Promise Rejection:", err?.message));

startProvider();