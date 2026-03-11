require("dotenv").config();
require("./zoomReminder");

const puppeteer = require("puppeteer");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const TelegramBot = require("node-telegram-bot-api");

// Flag utility
let getFlagEmoji;
try {
  getFlagEmoji = require("./src/utils/flag");
} catch {
  getFlagEmoji = () => "🌍"; 
}

// ==============================
// CONFIG
// ==============================
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const TARGET_URL = "https://www.rebirthcharity.com/Home/GlobalTeam"; // 🚨 Updated URL

const bot = new TelegramBot(BOT_TOKEN, { polling: true, filepath: false });

let refreshLoop;
let queue = [];
let knownIds = new Set();

// ==============================
// BROWSER LOCK CLEANUP (Zombie Process Fix)
// ==============================
function cleanupLock() {
  const lockFile = path.join(__dirname, "profile_watcher", "SingletonLock");
  if (fs.existsSync(lockFile)) {
    try {
      fs.unlinkSync(lockFile);
      console.log("🔓 Existing browser lock cleared.");
    } catch (e) {
      // ignore
    }
  }
}

// ==============================
// LOAD & SAVE IDs
// ==============================
try {
  if (fs.existsSync("sent.json")) {
    const data = fs.readFileSync("sent.json", "utf8");
    knownIds = new Set(data ? JSON.parse(data) : []);
  }
} catch {
  fs.writeFileSync("sent.json", "[]");
}

function saveIds() {
  const arr = [...knownIds];
  if (arr.length > 5000) {
    const trimmed = arr.slice(-3000);
    knownIds = new Set(trimmed);
  }
  fs.writeFileSync("sent.json", JSON.stringify([...knownIds], null, 2));
}

// ==============================
// TELEGRAM SENDER LOGIC
// ==============================
async function sendTelegram(user) {
  const flag = getFlagEmoji(user.country);
  const message = `
🚀🔥 <b>REBIRTH CHARITY – NEW MEMBER JOINED</b> 🔥🚀
━━━━━━━━━━━━━━━━━━
👤 <b>Name:</b> ${user.name}
🆔 <b>User ID:</b> <code>${user.id}</code>
🌍 <b>Country:</b> ${flag} ${user.country}
💲 <b>Donate:</b> $30
━━━━━━━━━━━━━━━━━━
⏰ <b>Date & Time:</b> ${new Date().toLocaleString()}

🎉 <b>Congratulations & Welcome to REBIRTH CHARITY!</b>

💰 <i>Start your journey and grow with our Rebirth charity community.</i>
━━━━━━━━━━━━━━━━━━
🔥 <b>More leaders are joining every day!</b>
🚀 <b>Don't miss the opportunity – Join Now!</b>
`;

  try {
    await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      chat_id: CHAT_ID,
      text: message,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [[{ text: "🚀 Join Now", url: "https://t.me/Rebirth_Charity_bot?start=app" }]]
      }
    });
    console.log("✅ Sent to Telegram:", user.id);
  } catch (err) {
    console.log("Telegram Error:", err.message);
  }
}

// ==============================
// MAIN WATCHER (Updated for Global Team Page)
// ==============================
async function startWatcher() {
  cleanupLock();
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      userDataDir: "./profile_watcher",
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-blink-features=AutomationControlled"]
    });

    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(60000);

    // Browser Crash Handlers
    browser.on("disconnected", () => {
      console.log("Browser disconnected → restarting...");
      clearInterval(refreshLoop);
      setTimeout(startWatcher, 5000);
    });

    console.log("🚀 WATCHER STARTED (URL: GlobalTeam)");

    refreshLoop = setInterval(async () => {
      try {
        await page.goto(TARGET_URL, { waitUntil: "networkidle2" });

        // Extracting data from member-card-row
        const users = await page.evaluate(() => {
          const cards = document.querySelectorAll(".member-card-row");
          return [...cards].map(c => {
            const idText = c.querySelector(".member-id-badge")?.innerText || "";
            return {
              id: idText.replace("ID : ", "").trim(),
              name: c.querySelector(".member-name")?.innerText.trim() || "N/A",
              country: c.querySelector(".member-country")?.innerText.trim() || "Unknown"
            };
          });
        });

        // Reverse check taaki purani IDs skip ho jayein aur naye upar se aayein
        for (const u of users) {
          if (u.id && !knownIds.has(u.id)) {
            knownIds.add(u.id);
            saveIds();
            queue.push(u);
            console.log("🆕 New User Found:", u.id, u.name);
          }
        }
      } catch (err) {
        console.log("Refresh/Scrape Error:", err.message);
      }
    }, 25000); // 25 seconds interval

  } catch (err) {
    console.log("Launch Error:", err.message);
    if (browser) await browser.close();
    setTimeout(startWatcher, 10000);
  }
}

startWatcher();

// Queue Processor (Every 10 seconds)
setInterval(async () => {
  if (queue.length === 0) return;
  const user = queue.shift();
  await sendTelegram(user);
}, 10000);

// Global Handlers
process.on("uncaughtException", (err) => console.log("Uncaught:", err.message));
process.on("unhandledRejection", (err) => console.log("Unhandled:", err?.message || err));