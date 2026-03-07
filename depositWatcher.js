require("dotenv").config();

const { ethers } = require("ethers");
const TelegramBot = require("node-telegram-bot-api");

// ================= ENV =================

const RPC = process.env.BSC_NODE_URL;
const TELEGRAM_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = process.env.CHAT_ID;

// ================= ADDRESSES =================

const WATCH_ADDRESS =
  "0xc8Bcf348A74018B11DCB52765Bd818E85FBE6A3f".toLowerCase();

const USDT_CONTRACT =
  "0x55d398326f99059ff775485246999027b3197955";

// ================= CHECK =================

if (!RPC || !TELEGRAM_TOKEN || !CHANNEL_ID) {
  console.log("❌ Missing ENV values");
  process.exit(1);
}

// ================= PROVIDER =================
// Stable polling provider (RPC filter error fix)

const provider = new ethers.JsonRpcProvider(RPC, {
  polling: true,
  pollingInterval: 4000
});

// ================= TELEGRAM =================

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });

// ================= ABI =================

const ABI = [
  "event Transfer(address indexed from,address indexed to,uint256 value)"
];

// ================= CONTRACT =================

const contract = new ethers.Contract(USDT_CONTRACT, ABI, provider);

console.log("🔥 Rebirth Deposit Scanner Started");
console.log("👀 Watching wallet:", WATCH_ADDRESS);

// ================= SETTINGS =================

const DECIMALS = 18;
let txPool = [];

// ================= FILTER =================

function isValidAmount(amount) {
  if (amount < 30 || amount > 900) return false;
  if (amount % 30 !== 0) return false;
  return true;
}

// ================= LISTENER =================

contract.on("Transfer", async (from, to, value, event) => {

  try {

    const amount = Number(
      ethers.formatUnits(value, DECIMALS)
    );

    const toAddress = to.toLowerCase();

    console.log("TX detected:", from, "→", toAddress, "Amount:", amount);

    // ================= WALLET (NO FILTER) =================

    if (toAddress === WATCH_ADDRESS) {

      console.log("✅ Deposit to WATCH_ADDRESS detected");

      txPool.push({
        from,
        to,
        amount,
        hash: event.log.transactionHash
      });

      return;
    }

    // ================= USDT CONTRACT FILTER =================

    if (toAddress === USDT_CONTRACT.toLowerCase()) {

      if (!isValidAmount(amount)) return;

      console.log("✅ Valid USDT contract deposit detected");

      txPool.push({
        from,
        to,
        amount,
        hash: event.log.transactionHash
      });

    }

  } catch (err) {

    console.log("Listener Error:", err.message);

  }

});

// ================= RANDOM =================

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ================= SENDER LOOP =================

setInterval(async () => {

  try {

    if (txPool.length === 0) {

      console.log("⏳ No deposits found");

      return;

    }

    const sendCount = randomInt(1, 4);

    const shuffled = txPool.sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, sendCount);

    for (const tx of selected) {

      const message = `
🚀🔥 REBIRTH CHARITY – NEW DEPOSIT 🔥🚀
━━━━━━━━━━━━━━━━━━

💰 Amount: $${tx.amount} USDT

📤 From:
${tx.from}

📥 To:
${tx.to}

🔗 Transaction:
https://bscscan.com/tx/${tx.hash}

━━━━━━━━━━━━━━━━━━
🎉 Successful Deposit Confirmed
`;

      await bot.sendMessage(CHANNEL_ID, message);

      console.log("📤 Sent deposit to Telegram:", tx.amount);

    }

    txPool = [];

  } catch (err) {

    console.log("Send Error:", err.response?.body || err.message);

  }

}, 300000); // 5 minutes