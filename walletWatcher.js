require("dotenv").config();

const { ethers } = require("ethers");
const TelegramBot = require("node-telegram-bot-api");

// ================= ENV =================

const RPC1 = process.env.RPC_WALLET;
const RPC2 = process.env.RPC_BACKUP;

const TELEGRAM_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = process.env.CHAT_ID;

if (!RPC1 || !TELEGRAM_TOKEN || !CHANNEL_ID) {
  console.log("❌ Missing ENV values");
  process.exit(1);
}

// ================= SETTINGS =================

const WATCH = "0xc8bcf348a74018b11dcb52765bd818e85fbe6a3f".toLowerCase();

const USDT = "0x55d398326f99059ff775485246999027b3197955";

const DECIMALS = 18;
const MIN_AMOUNT = 1; // Minimum 1 USDT

// ================= PROVIDER & CONTRACT =================

let provider;
let contract;

function createProvider(rpc) {
  const ws = new ethers.WebSocketProvider(rpc);

  // Catch websocket errors directly
  if (ws.websocket) {
    ws.websocket.on("error", (err) => {
      console.log("⚠ WebSocket error:", err.message);
    });

    ws.websocket.on("close", () => {
      console.log("⚠ WebSocket closed, reconnecting...");
      setTimeout(startProvider, 3000);
    });
  }

  return ws;
}

function startProvider() {
  console.log("🔌 Connecting RPC...");

  try {
    provider = createProvider(RPC1);
  } catch (e) {
    console.log("⚠ Main RPC failed, using backup");
    provider = createProvider(RPC2);
  }

  startBot();
}

// ================= TELEGRAM =================

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });

// ================= ABI =================

const ABI = [
  "event Transfer(address indexed from,address indexed to,uint256 value)"
];

// ================= MEMORY =================

let sent = new Set();

// ================= TELEGRAM SEND =================

async function send(tx) {
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

  try {
    await bot.sendMessage(CHANNEL_ID, message);
    console.log("📤 Sent to Telegram:", tx.amount, "USDT");
  } catch (e) {
    console.log("Telegram error:", e.message);
  }
}

// ================= BOT INIT =================

function startBot() {
  contract = new ethers.Contract(USDT, ABI, provider);

  console.log("👀 Wallet watcher started");
  console.log("Watching:", WATCH);

  loadLast10();
  startListener();
}

// ================= LAST SCAN (PAST 10) =================

async function loadLast10() {
  console.log("📦 Loading last deposits...");

  try {
    const currentBlock = await provider.getBlockNumber();
    
    // FIX 1: Increased fromBlock distance to search deep enough (approx last ~4 hours)
    const fromBlock = currentBlock - 5000; 

    const transferTopic = ethers.id("Transfer(address,address,uint256)");

    const logs = await provider.getLogs({
      address: USDT,
      fromBlock,
      toBlock: currentBlock,
      topics: [
        transferTopic,
        null,
        ethers.zeroPadValue(WATCH, 32)
      ]
    });

    let found = 0;

    // Read from newest to oldest
    for (let i = logs.length - 1; i >= 0; i--) {
      // FIX 2: Stop at 10 instead of 5
      if (found >= 10) break; 

      const log = logs[i];

      try {
        const parsed = contract.interface.parseLog(log);
        
        const amount = Number(
          ethers.formatUnits(parsed.args.value, DECIMALS)
        );

        if (amount < MIN_AMOUNT) continue;

        const hash = log.transactionHash;

        if (sent.has(hash)) continue;

        await send({
          from: parsed.args.from,
          to: parsed.args.to,
          amount,
          hash
        });

        sent.add(hash);
        found++;
      } catch (parseErr) {
        // Skip log if parsing fails
      }
    }

    console.log(`✅ Loaded last ${found} valid deposits.`);

  } catch (err) {
    console.log("Past scan error:", err.message);
  }
}

// ================= LIVE LISTENER =================

function startListener() {
  console.log("🎧 Live listener started");

  contract.removeAllListeners();

  // FIX 3: Add a specific filter! Ab bot sirf WATCH address aane wale USDT ko hi sochega, poore BSC network ka load nahi lega.
  const filter = contract.filters.Transfer(null, WATCH);

  contract.on(filter, async (from, to, value, event) => {
    try {
      if (!to || to.toLowerCase() !== WATCH) return;

      const amount = Number(ethers.formatUnits(value, DECIMALS));

      if (amount < MIN_AMOUNT) return;

      const hash = event.log.transactionHash;

      if (sent.has(hash)) return;

      console.log("💰 Live Deposit detected:", amount, "USDT");

      await send({
        from,
        to,
        amount,
        hash
      });

      sent.add(hash);

      // Memory cleanup taaki server hang na ho
      if (sent.size > 2000) {
        sent.clear();
      }

    } catch (err) {
      console.log("Listener error:", err.message);
    }
  });
}

// ================= GLOBAL ERROR PROTECTION =================
// Yeh code ko crash hone se bachayega agar internet ya RPC down ho jaye
process.on("uncaughtException", (err) => {
  console.log("Uncaught Exception:", err.message);
});

process.on("unhandledRejection", (err) => {
  console.log("Unhandled Rejection:", err?.message || err);
});

// ================= START =================

startProvider();

// keep process alive
setInterval(() => {}, 1000);