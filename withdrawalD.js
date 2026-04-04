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

// ================= LIMITS & TIMING =================
let txQueue = []; 
let hourlyTracker = []; // Ab isme { time, type } save hoga
const MAX_PER_HOUR = 5; // 1 ghante mein total max 5 messages
const MAX_OLD_PER_HOUR = 2; // Purane amounts sirf 3 allow honge (2 naye ke liye reserve)

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
    
    provider.on("error", (err) => {
      console.log("🚨 Provider Error! Restarting...", err.message);
      setTimeout(startProvider, 5000);
    });

    provider.pollingInterval = 4000;
    await provider.getNetwork();
    console.log("✅ Network Ready!");
    startBot();
  } catch (err) {
    console.log("❌ Connection Error:", err.message, "Retrying...");
    setTimeout(startProvider, 5000);
  }
}

// ================= QUOTA SYSTEM VALIDATION =================
function isValidTransaction(amount) {
  const oldAmounts = [9, 18, 27, 36, 45, 54];
  const newAmounts = [7.2, 14.4, 28.8, 57.6];
  
  let type = "";
  
  if (oldAmounts.includes(amount)) {
    type = "old";
  } else if (newAmounts.includes(amount)) {
    type = "new";
  } else {
    // Exact match nahi hua toh reject
    return { valid: false }; 
  }

  const now = Date.now();
  // Filter records older than 1 hour (dhyaan rakhein ab object check kar rahe hain)
  hourlyTracker = hourlyTracker.filter(record => now - record.time < 3600000);

  // Sirf purane amounts ka count nikalein
  const oldMsgCount = hourlyTracker.filter(record => record.type === "old").length;

  // Agar amount purana hai aur uski limit poori ho chuki hai
  if (type === "old" && oldMsgCount >= MAX_OLD_PER_HOUR) {
    console.log(`⚠️ Old Amount Quota Full (${MAX_OLD_PER_HOUR}). Naye amounts ke liye reserved. Skipping: ${amount} USDT`);
    return { valid: false };
  }

  // Total messages ki limit check karein
  if (hourlyTracker.length >= MAX_PER_HOUR) {
    console.log(`⚠️ Total Hourly Limit Full. Skipping: ${amount} USDT`);
    return { valid: false };
  }

  return { valid: true, type: type };
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

// ================= LISTENER =================
function startListener() {
  if (!contract) return;
  
  contract.removeAllListeners();
  console.log("👂 Listening for USDT Transfers...");

  contract.on("Transfer", async (from, to, value, event) => {
    try {
      const amount = Number(ethers.formatUnits(value, DECIMALS));
      const hash = event.log.transactionHash;

      if (sent.has(hash)) return;

      // Naya validation function use karna jo object return karta hai
      const validation = isValidTransaction(amount);

      if (validation.valid) {
        console.log(`📦 Matched & Queued: ${amount} USDT [Type: ${validation.type.toUpperCase()}]`);
        sent.add(hash);
        
        // Puraane Date.now() ki jagah object save kar rahe hain taaki count sahi rahe
        hourlyTracker.push({ time: Date.now(), type: validation.type });
        txQueue.push({ from, to, amount, hash });
      }

      if (sent.size > 2000) sent.clear();

    } catch (err) {
      console.log("⚠️ Listener Data Error:", err.message);
      if (err.message.includes("block") || err.message.includes("filter")) {
        startProvider();
      }
    }
  });

  // 🔄 AUTO-REFRESH JUGAD
  if (global.refreshTimeout) clearTimeout(global.refreshTimeout);
  global.refreshTimeout = setTimeout(() => {
    console.log("♻️ Periodic Listener Refresh to keep connection alive...");
    startListener();
  }, 15 * 60 * 1000); 
}

// ================= BOT INIT =================
function startBot() {
  contract = new ethers.Contract(USDT, ABI, provider);
  console.log("🚀 Scanner Active");
  
  startListener();
  
  if (!global.isLoopRunning) {
    senderLoop();
  }
}

// ================= ERROR PROTECTION =================
process.on("uncaughtException", (err) => console.log("System Error:", err.message));
process.on("unhandledRejection", (err) => console.log("Promise Rejection:", err?.message));

startProvider();