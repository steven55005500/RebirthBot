require("dotenv").config();
require("./zoomReminder");

const puppeteer = require("puppeteer");
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

let queue = [];
let knownIds = new Set();

// LOAD IDs
try {
  if (fs.existsSync("sent.json")) {
    knownIds = new Set(JSON.parse(fs.readFileSync("sent.json", "utf8")));
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
    await bot.sendMessage(CHAT_ID, message, { parse_mode: "HTML" });
    console.log("✅ Sent to Telegram:", user.id);
  } catch (err) {
    console.log("❌ Telegram Error");
  }
}

async function startWatcher() {
  // Lock cleaning
  const profilePath = path.join(__dirname, "profile");
  if (fs.existsSync(profilePath)) {
    const lock = path.join(profilePath, "SingletonLock");
    if (fs.existsSync(lock)) try { fs.unlinkSync(lock); } catch(e){}
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      userDataDir: "./profile",
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
    });

    const page = await browser.newPage();
    
    // ⚡ SUPER SPEED: Block everything except HTML
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const type = req.resourceType();
      if (['image', 'stylesheet', 'font', 'script', 'media'].includes(type)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
    
    // Site slow ho toh bhi wait karega (2 minute max)
    page.setDefaultNavigationTimeout(120000);

    console.log("🚀 WATCHER ACTIVE - Monitoring Global Team (Fast Mode)");

    // Stable Loop
    while (true) {
      try {
        console.log("🔄 Checking for new members...");
        
        // 'networkidle0' ki jagah 'domcontentloaded' use kiya hai taaki timeout na ho
        await page.goto(TARGET_URL, { waitUntil: "domcontentloaded", timeout: 60000 });

        const users = await page.evaluate(() => {
          const cards = document.querySelectorAll(".member-card-row");
          return Array.from(cards).map(c => ({
            id: (c.querySelector(".member-id-badge")?.innerText || "").replace("ID : ", "").trim(),
            name: c.querySelector(".member-name")?.innerText.trim() || "N/A",
            country: c.querySelector(".member-country")?.innerText.trim() || "Unknown"
          }));
        });

        if (users.length > 0) {
          for (const u of users) {
            if (u.id && !knownIds.has(u.id)) {
              knownIds.add(u.id);
              saveIds();
              queue.push(u);
              console.log("🆕 New User:", u.id);
            }
          }
        }

        // Har 30 second baad refresh karega agar site chalu hai
        await new Promise(r => setTimeout(r, 30000));

      } catch (err) {
        console.log("⏳ Site unreachable or slow, retrying in 10s...");
        await new Promise(r => setTimeout(r, 10000));
      }
    }

  } catch (err) {
    console.log("❌ Watcher Crash:", err.message);
    if (browser) await browser.close();
    setTimeout(startWatcher, 5000);
  }
}

// Start Processing
startWatcher();

// Telegram Queue Processor (Har 3 sec mein)
setInterval(async () => {
  if (queue.length > 0) {
    await sendTelegram(queue.shift());
  }
}, 3000);

// Prevention from unexpected crashes
process.on("uncaughtException", (err) => console.log("System Error:", err.message));
process.on("unhandledRejection", (err) => console.log("System Rejection"));