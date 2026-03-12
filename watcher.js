require("dotenv").config();
// require("./zoomReminder"); // Agar ye file local par nahi hai, toh isse comment kar dena test karte waqt

// Puppeteer-extra use kiya hai taaki block na ho
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

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
  
  // Date format set for exact output like "3/11/2026, 12:08:02 PM"
  const dateStr = new Date().toLocaleString("en-US");

  const message = `🚀 🔥 <b>REBIRTH CHARITY – NEW MEMBER JOINED</b> 🔥 🚀
━━━━━━━━━━━━━━━━━━
👤 <b>Name:</b> ${user.name}
🆔 <b>User ID:</b> <code>${user.id}</code>
🌍 <b>Country:</b> ${flag} ${user.country}
💲 <b>Donate:</b> $30
━━━━━━━━━━━━━━━━━━
⏰ <b>Date & Time:</b> ${dateStr}

🎉 <b>Congratulations & Welcome to REBIRTH CHARITY!</b>

💰 <i>Start your journey and grow with our Rebirth charity community.</i>

🔥 More leaders are joining every day!
🚀 Don't miss the opportunity – Join Now!`;

  const options = {
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: [
        [
          { 
            text: "🚀 Join Rebirth Charity Now", 
            url: "https://t.me/Rebirth_Charity_bot?start=join" 
          }
        ],
        [
          { 
            text: "🌐 Open in Browser", 
            url: "https://www.rebirthcharity.com" 
          }
        ]
      ]
    }
  };

  try {
    await bot.sendMessage(CHAT_ID, message, options);
    console.log("✅ Sent to Telegram:", user.id);
  } catch (err) {
    console.log("❌ Telegram Error:", err.message);
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
      headless: "new", // Naya headless mode server par jyada stable hai
      userDataDir: "./profile",
      args: [
        "--no-sandbox", 
        "--disable-setuid-sandbox", 
        "--disable-dev-shm-usage", 
        "--disable-gpu",
        "--disable-blink-features=AutomationControlled" // Ye line bhi site ko bewakoof banati hai
      ]
    });

    const page = await browser.newPage();
    
    // Server par thoda random User-Agent lagaya hai
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
    
    // Timeout thoda badha diya hai server ke hisaab se
    page.setDefaultNavigationTimeout(180000);

    console.log("🚀 WATCHER ACTIVE - Monitoring Global Team (Stealth Mode)");

    // Stable Loop
    while (true) {
      try {
        console.log("🔄 Checking for new members...");
        
        // networkidle2 use kiya hai taaki site puri load ho
        await page.goto(TARGET_URL, { waitUntil: "networkidle2", timeout: 90000 });

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
        } else {
            console.log("ℹ️ No new members found on page this check.");
        }

        // Har 30 second baad refresh karega
        await new Promise(r => setTimeout(r, 30000));

      } catch (err) {
        console.log("⏳ Site unreachable or slow, retrying in 15s...");
        await new Promise(r => setTimeout(r, 15000));
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

// Telegram Queue Processor
setInterval(async () => {
  if (queue.length > 0) {
    await sendTelegram(queue.shift());
  }
}, 3000);

process.on("uncaughtException", (err) => console.log("System Error:", err.message));
process.on("unhandledRejection", (err) => console.log("System Rejection:", err.message));