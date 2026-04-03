require("dotenv").config();
const { ethers } = require("ethers");
const TelegramBot = require("node-telegram-bot-api");

// ================= ENV =================
const RPC_PRIMARY = process.env.RPC_WALLET;
const RPC_BACKUP = process.env.RPC_BACKUP;
const TELEGRAM_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = process.env.CHAT_ID;

if (!RPC_PRIMARY || !RPC_BACKUP || !TELEGRAM_TOKEN || !CHANNEL_ID) {
  console.log("❌ Missing ENV values");
  process.exit(1);
}

// ================= SETTINGS =================
const WATCH = "0x6EAef156c3E3020326A8Db7AE8953C7aB382b078".toLowerCase();
const USDT = "0x55d398326f99059ff775485246999027b3197955";
const DECIMALS = 18;

// ================= GLOBAL =================
let provider;
let contract;
let currentRPC = RPC_PRIMARY;
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });
const ABI = ["event Transfer(address indexed from, address indexed to, uint256 value)"];
let sent = new Set();

// ================= CONNECT FUNCTION =================
function connectProvider(rpcUrl) {
  console.log(`🔌 Connecting to: ${rpcUrl}`);

  provider = new ethers.WebSocketProvider(rpcUrl);
// Connect hone par
  provider.websocket.onopen = () => {
    console.log("✅ WebSocket Connected");
    startBot();
  };

  // Disconnect hone par
  provider.websocket.onclose = () => {
    console.log("❌ WebSocket Disconnected");
    currentRPC = currentRPC === RPC_PRIMARY ? RPC_BACKUP : RPC_PRIMARY;
    console.log("🔁 Switching RPC...");
    setTimeout(() => connectProvider(currentRPC), 3000);
  };

  // Error aane par
  provider.websocket.onerror = (err) => {
    console.log("⚠️ WebSocket Error:", err.message);
  };
}

// ================= TELEGRAM =================
async function sendNotification(tx) {
  const message = `
🚀 REBIRTH CHARITY – WITHDRAWAL PROCESSED
━━━━━━━━━━━━━━━━━━
💰 Amount: $${tx.amount} USDT

📤 From:
${tx.from}

📥 To:
${tx.to}

🔗 Transaction:
https://bscscan.com/tx/${tx.hash}

━━━━━━━━━━━━━━━━━━
✅ Withdrawal Completed Successfully
`;

  try {
    await bot.sendMessage(CHANNEL_ID, message);
    console.log("📤 Sent:", tx.amount, "USDT");
  } catch (e) {
    console.log("Telegram error:", e.message);
  }
}

// ================= BOT INIT =================
function startBot() {
  contract = new ethers.Contract(USDT, ABI, provider);
  console.log("👀 Monitoring (ONLY OUTGOING):", WATCH);
  startListener();
}

// ================= LISTENER =================
function startListener() {
  console.log("🎧 Listening withdrawals...");

  contract.removeAllListeners();

  contract.on("Transfer", async (from, to, value, event) => {
    try {
      const fromAddr = from.toLowerCase();

      // Only outgoing
      if (fromAddr !== WATCH) return;

      const amount = Number(ethers.formatUnits(value, DECIMALS));
      const hash = event.log.transactionHash;

      if (sent.has(hash)) return;

      sent.add(hash);

      await sendNotification({ from, to, amount, hash });

      if (sent.size > 2000) sent.clear();

    } catch (err) {
      console.log("Listener error:", err.message);
    }
  });
}

// ================= ERROR HANDLING =================
process.on("uncaughtException", (err) => console.log("Crash:", err.message));
process.on("unhandledRejection", (err) => console.log("Promise Error:", err?.message));

// ================= START =================
connectProvider(currentRPC);
setInterval(() => {}, 1000);