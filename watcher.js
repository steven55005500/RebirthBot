require("dotenv").config();
// require("./zoomReminder"); // Local test ke bina ise comment rakhein

// Anti-bot plugins setup
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
        [{ text: "🚀 Join Rebirth Charity Now", url: "https://t.me/Rebirth_Charity_bot?start=join" }],
        [{ text: "🌐 Open in Browser", url: "https://www.rebirthcharity.com" }]
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

// Function to generate random delays to act like a human
const delay = (time) => new Promise(resolve => setTimeout(resolve, time));

async function startWatcher() {
  const profilePath = path.join(__dirname, "profile");
  if (fs.existsSync(profilePath)) {
    const lock = path.join(profilePath, "SingletonLock");
    if (fs.existsSync(lock)) try { fs.unlinkSync(lock); } catch(e){}
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      userDataDir: "./profile",
      args: [
        "--no-sandbox", 
        "--disable-setuid-sandbox", 
        "--disable-dev-shm-usage", 
        "--disable-gpu",
        "--disable-blink-features=AutomationControlled", // Anti-bot bypass
        "--window-size=1920,1080", // Real screen size
        "--disable-features=IsolateOrigins,site-per-process" // Prevent cross-origin blocks
      ],
      ignoreHTTPSErrors: true
    });

    const page = await browser.newPage();
    
    // Set a very standard Windows Chrome User Agent
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
    
    // Set view port to look like a desktop
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Inject custom JS to hide webdriver (Extra stealth)
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    });

    // We don't need heavy images/fonts, blocking them makes it faster but allows JS
    await page.setRequestInterception(true);
    page.on('request', (req) => {
        if (['image', 'font', 'media'].includes(req.resourceType())) {
            req.abort();
        } else {
            req.continue();
        }
    });

    page.setDefaultNavigationTimeout(120000); // 2 Min timeout
    console.log("🚀 WATCHER ACTIVE - Monitoring Global Team (Ultimate Stealth)");

    while (true) {
      try {
        console.log("🔄 Checking for new members...");
        
        // waitUntil: 'domcontentloaded' is much faster and bypasses long loading spinners
        await page.goto(TARGET_URL, { waitUntil: "domcontentloaded", timeout: 60000 });

        // Wait specifically for the member cards to appear (max 15 seconds wait)
        try {
            await page.waitForSelector(".member-card-row", { timeout: 15000 });
        } catch (e) {
            console.log("⚠️ Elements not found immediately, checking anyway...");
        }

        const users = await page.evaluate(() => {
          const cards = document.querySelectorAll(".member-card-row");
          return Array.from(cards).map(c => ({
            id: (c.querySelector(".member-id-badge")?.innerText || "").replace("ID : ", "").trim(),
            name: c.querySelector(".member-name")?.innerText.trim() || "N/A",
            country: c.querySelector(".member-country")?.innerText.trim() || "Unknown"
          }));
        });

        if (users.length > 0) {
          console.log(`✅ Found ${users.length} total members on page.`);
          for (const u of users) {
            if (u.id && !knownIds.has(u.id)) {
              knownIds.add(u.id);
              saveIds();
              queue.push(u);
              console.log("🆕 New User:", u.id);
            }
          }
        } else {
            console.log("ℹ️ Site loaded, but no members found on page.");
        }

        // Random wait between 25-35 seconds to look human
        const randomWait = Math.floor(Math.random() * (35000 - 25000 + 1) + 25000);
        await delay(randomWait);

      } catch (err) {
        console.log(`⏳ Error loading page: ${err.message}. Retrying in 15s...`);
        await delay(15000);
      }
    }

  } catch (err) {
    console.log("❌ Watcher Crash:", err.message);
    if (browser) await browser.close();
    setTimeout(startWatcher, 5000);
  }
}

startWatcher();

setInterval(async () => {
  if (queue.length > 0) {
    await sendTelegram(queue.shift());
  }
}, 3000);

process.on("uncaughtException", (err) => console.log("System Error:", err.message));
process.on("unhandledRejection", (err) => console.log("System Rejection:", err.message));