require("dotenv").config();
require("./zoomReminder");

const puppeteer = require("puppeteer");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const TelegramBot = require("node-telegram-bot-api");

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
    await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      chat_id: CHAT_ID,
      text: message,
      parse_mode: "HTML",
    });
    console.log("✅ Message Sent:", user.id);
  } catch (err) {
    console.log("Telegram Error");
  }
}

async function startWatcher() {
  // Lock clear
  const lock = path.join(__dirname, "profile_watcher", "SingletonLock");
  if (fs.existsSync(lock)) { try { fs.unlinkSync(lock); } catch(e){} }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      userDataDir: "./profile_watcher",
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();
    
    // 1. Realistic User-Agent add kiya taaki timeout kam ho
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

    // 2. Timeout badha kar 2 minute (120000ms) kiya
    page.setDefaultNavigationTimeout(120000);

    console.log("🚀 WATCHER STARTED (URL: GlobalTeam)");

    refreshLoop = setInterval(async () => {
      try {
        console.log("Refreshing page...");
        
        // 3. 'networkidle2' ki jagah 'domcontentloaded' use kiya taaki jaldi load ho
        await page.goto(TARGET_URL, { waitUntil: "domcontentloaded", timeout: 120000 });

        // Table load hone ka wait karein
        await page.waitForSelector(".member-card-row", { timeout: 10000 }).catch(() => null);

        const users = await page.evaluate(() => {
          const cards = document.querySelectorAll(".member-card-row");
          return [...cards].map(c => ({
            id: (c.querySelector(".member-id-badge")?.innerText || "").replace("ID : ", "").trim(),
            name: c.querySelector(".member-name")?.innerText.trim() || "N/A",
            country: c.querySelector(".member-country")?.innerText.trim() || "Unknown"
          }));
        });

        if (users.length === 0) console.log("⚠️ No members found on page.");

        for (const u of users) {
          if (u.id && !knownIds.has(u.id)) {
            knownIds.add(u.id);
            saveIds();
            queue.push(u);
            console.log("🆕 New User:", u.id);
          }
        }
      } catch (err) {
        console.log("⏳ Connection slow (Retrying):", err.message);
      }
    }, 40000); // Interval thoda badha kar 40 sec kiya taaki load hone ka time mile

  } catch (err) {
    console.log("Launch error:", err.message);
    if (browser) await browser.close();
    setTimeout(startWatcher, 10000);
  }
}

startWatcher();

setInterval(async () => {
  if (queue.length > 0) await sendTelegram(queue.shift());
}, 5000);