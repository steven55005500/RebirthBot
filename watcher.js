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

🎉 <b>Congratulations & Welcome!</b>
`;

  try {
    await bot.sendMessage(CHAT_ID, message, { parse_mode: "HTML" });
    console.log("✅ Message Sent to Telegram:", user.id);
  } catch (err) {
    console.log("❌ Telegram Send Error:", err.message);
  }
}

// ==============================
// MAIN WATCHER (Fast Mode)
// ==============================
async function startWatcher() {
  // Lock clear logic
  const lock = path.join(__dirname, "profile_watcher", "SingletonLock");
  if (fs.existsSync(lock)) { try { fs.unlinkSync(lock); } catch(e){} }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      userDataDir: "./profile_watcher",
      args: [
        "--no-sandbox", 
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu"
      ]
    });

    const page = await browser.newPage();
    
    // ⚡ SPEED HACK: Block Images, CSS, and Fonts
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const type = req.resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(type)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36");
    page.setDefaultNavigationTimeout(150000); // 2.5 Minutes timeout

    console.log("🚀 WATCHER STARTED (Fast Mode - URL: GlobalTeam)");

    refreshLoop = setInterval(async () => {
      try {
        console.log("🔄 Refreshing Data...");
        
        // Use 'domcontentloaded' for faster scraping
        await page.goto(TARGET_URL, { waitUntil: "domcontentloaded", timeout: 120000 });

        // Wait for the specific member cards to appear
        await page.waitForSelector(".member-card-row", { timeout: 15000 }).catch(() => null);

        const users = await page.evaluate(() => {
          const cards = document.querySelectorAll(".member-card-row");
          return [...cards].map(c => ({
            id: (c.querySelector(".member-id-badge")?.innerText || "").replace("ID : ", "").trim(),
            name: c.querySelector(".member-name")?.innerText.trim() || "N/A",
            country: c.querySelector(".member-country")?.innerText.trim() || "Unknown"
          }));
        });

        // Loop through found users (Newest first)
        for (const u of users) {
          if (u.id && !knownIds.has(u.id)) {
            knownIds.add(u.id);
            saveIds();
            queue.push(u);
            console.log("🆕 New User Found:", u.id, u.name);
          }
        }
      } catch (err) {
        console.log("⏳ Server slow or busy, retrying next loop...");
      }
    }, 45000); // Check every 45 seconds

  } catch (err) {
    console.log("❌ Launch error:", err.message);
    if (browser) await browser.close();
    setTimeout(startWatcher, 10000);
  }
}

startWatcher();

// ==============================
// QUEUE PROCESSOR
// ==============================
setInterval(async () => {
  if (queue.length > 0) {
    const user = queue.shift();
    await sendTelegram(user);
  }
}, 7000); // Process queue every 7 seconds