require("dotenv").config();
require("./zoomReminder");

const puppeteer = require("puppeteer");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const TelegramBot = require("node-telegram-bot-api");

// Flag utility support
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
const TARGET_URL = "https://www.rebirthcharity.com/Home/GlobalTeam"; 

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

let refreshLoop;
let queue = [];
let knownIds = new Set();

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
  fs.writeFileSync("sent.json", JSON.stringify([...knownIds], null, 2));
}

// ==============================
// TELEGRAM SENDER
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

💰 <i>Start your journey and grow with our community.</i>
━━━━━━━━━━━━━━━━━━
`;

  try {
    await bot.sendMessage(CHAT_ID, message, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [[{ text: "🚀 Join Now", url: "https://t.me/Rebirth_Charity_bot?start=app" }]]
      }
    });
    console.log("✅ Sent to Telegram:", user.id);
  } catch (err) {
    console.log("❌ Telegram Error:", err.message);
  }
}

// ==============================
// MAIN WATCHER
// ==============================
async function startWatcher() {
  // Purana SingletonLock saaf karne ke liye
  const profilePath = path.join(__dirname, "profile");
  ["SingletonLock", "SingletonSocket", "SingletonCookie"].forEach(f => {
    const p = path.join(profilePath, f);
    if (fs.existsSync(p)) try { fs.unlinkSync(p); } catch(e){}
  });

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      userDataDir: "./profile",
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
    });

    const page = await browser.newPage();
    
    // ⚡ SPEED HACK: Block Images aur CSS taaki fast load ho
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (['image', 'stylesheet', 'font'].includes(req.resourceType())) req.abort();
      else req.continue();
    });

    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36");
    page.setDefaultNavigationTimeout(90000);

    console.log("🚀 WATCHER STARTED (Public Mode: Global Team)");

    refreshLoop = setInterval(async () => {
      try {
        console.log("🔄 Fetching Data from GlobalTeam...");
        await page.goto(TARGET_URL, { waitUntil: "domcontentloaded", timeout: 60000 });

        // Aapke HTML ke hisaab se card selector
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

        // Check for new IDs
        for (const u of users) {
          if (u.id && !knownIds.has(u.id)) {
            knownIds.add(u.id);
            saveIds();
            queue.push(u);
            console.log("🆕 Found New Member:", u.id, u.name);
          }
        }
      } catch (err) {
        console.log("⏳ Refresh error (retrying):", err.message);
      }
    }, 30000); // 30 seconds refresh cycle

  } catch (err) {
    console.log("❌ Watcher Crash:", err.message);
    if (browser) await browser.close();
    setTimeout(startWatcher, 10000);
  }
}

startWatcher();

// Telegram Queue Processor (Har 5 sec mein bhejega)
setInterval(async () => {
  if (queue.length > 0) {
    await sendTelegram(queue.shift());
  }
}, 5000);

// Global Handlers
process.on("uncaughtException", (err) => console.log("Uncaught:", err.message));
process.on("unhandledRejection", (err) => console.log("Unhandled Rejection"));