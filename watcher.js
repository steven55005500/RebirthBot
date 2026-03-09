require("dotenv").config();
const puppeteer = require("puppeteer");
const axios = require("axios");
const fs = require("fs");
const TelegramBot = require("node-telegram-bot-api");

// Agar flag.js aapke paas hai toh isko rakhiye, warna comment kar dena
let getFlagEmoji;
try {
  getFlagEmoji = require("./src/utils/flag");
} catch {
  getFlagEmoji = () => "🌍"; // Fallback emoji agar flag.js na mile
}

// ==============================
// CONFIG
// ==============================

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const MINI_APP_URL = "https://www.rebirthcharity.com/Login/Login";
const TARGET_URL = "https://www.rebirthcharity.com/Report/AutoPoolTeam"; // 🚨 Target URL set kiya

const bot = new TelegramBot(BOT_TOKEN, { polling: true, filepath: false });

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
  console.log("sent.json reset");
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
// TELEGRAM SEND COMMANDS
// ==============================

bot.on("new_chat_members", (msg) => {
  const chatId = msg.chat.id;
  msg.new_chat_members.forEach((user) => {
    const name = user.first_name || "User";
    bot.sendMessage(
      chatId,
      `🎉 Welcome ${name} to Rebirth Charity!\n\n🚀 We're excited to have you here.\n\nStart your journey now 👇`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🚀 Open Rebirth Bot", url: "https://t.me/Rebirth_Charity_bot?start=app" }]
          ]
        }
      }
    );
  });
});

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "🚀 Welcome to Rebirth Charity\n\nChoose how you want to open the app 👇",
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📱 Open Mini App", web_app: { url: MINI_APP_URL } }],
          [{ text: "🔓 Login from Browser", url: MINI_APP_URL }]
        ]
      }
    }
  );
});

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
    await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        chat_id: CHAT_ID,
        text: message,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🚀 Join Rebirth Charity Now", url: "https://t.me/Rebirth_Charity_bot?start=app" }]
          ]
        }
      }
    );
    console.log("✅ Sent ID to Telegram:", user.id);
  } catch (err) {
    console.log("Telegram Error:", err.message);
  }
}

// ==============================
// AUTO LOGIN FUNCTION (Updated for Dashboard Redirect)
// ==============================

async function autoLogin(page) {
  try {
    // 2-second delay to let the page settle before checking login box
    await new Promise(r => setTimeout(r, 2000));
    
    const loginInput = await page.$("#txtusername");

    if (loginInput) {
      console.log("Session expired → Logging in...");

      await page.waitForSelector("#txtusername", { timeout: 20000 });
      await page.waitForSelector("input[type=password]", { timeout: 20000 });

      await page.click("#txtusername", { clickCount: 3 });
      await page.keyboard.press("Backspace");
      await page.type("#txtusername", process.env.LOGIN_ID, { delay: 50 });

      await page.click("input[type=password]", { clickCount: 3 });
      await page.keyboard.press("Backspace");
      await page.type("input[type=password]", process.env.LOGIN_PASS, { delay: 50 });

      await page.keyboard.press("Enter");

      await new Promise(r => setTimeout(r, 7000));

      console.log("LOGIN SUCCESS");

      // 🚨 FIX: Wapas table wale page par jao, dashboard par mat ruko!
      console.log("Redirecting back to AutoPoolTeam page...");
      await page.goto(TARGET_URL, { waitUntil: "domcontentloaded", timeout: 60000 });

    } else {
      console.log("Session active");
    }
  } catch (err) {
    console.log("Login error:", err.message);
  }
}

// ==============================
// MAIN WATCHER
// ==============================

async function startWatcher() {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      userDataDir: "./profile_watcher",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-crash-reporter",
        "--disable-blink-features=AutomationControlled"
      ],
      defaultViewport: null
    });

    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(0);

    // Browser/Page Crash Handlers
    browser.on("disconnected", () => {
      console.log("Browser disconnected → restarting watcher");
      clearInterval(refreshLoop);
      setTimeout(startWatcher, 5000);
    });

    page.on("error", async () => {
      console.log("Page crashed → restarting browser");
      try { await browser.close(); } catch {}
      clearInterval(refreshLoop);
      setTimeout(startWatcher, 5000);
    });

    await page.goto(TARGET_URL, { waitUntil: "networkidle2", timeout: 0 });

    console.log("🚀 WATCHER STARTED");

    // Start mein pehle auto login check karo
    await autoLogin(page);

    // Har 20 seconds mein page refresh karke IDs nikalna
    refreshLoop = setInterval(async () => {
      try {
        // 🚨 FIX: page.reload() ki jagah force goto TARGET_URL
        await page.goto(TARGET_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
        
        // Ensure logged in
        await autoLogin(page);

        // Wait for table to load
        await page.waitForSelector(".box-body table tbody tr", { timeout: 30000 });

        const users = await page.evaluate(() => {
          const rows = document.querySelectorAll(".box-body table tbody tr");
          return [...rows].map(r => ({
            sr: r.children[0]?.innerText.trim(),
            country: r.children[2]?.innerText.trim(),
            id: r.children[3]?.innerText.trim(),
            name: r.children[4]?.innerText.trim()
          }));
        });

        // Naye users upar aaye iske liye sort
        users.sort((a, b) => Number(b.sr) - Number(a.sr));

        for (const u of users) {
          if (!u.id) continue;
          if (!knownIds.has(u.id)) {
            knownIds.add(u.id);
            saveIds();
            queue.push(u);
            console.log("🆕 New User Found:", u.id);
          }
        }

      } catch (err) {
        if (err.message.includes("Execution context was destroyed")) {
          console.log("Page navigating... retrying");
          return;
        }
        console.log("Scrape error:", err.message);
        
        // 🚨 FIX: Agar table na mile, toh debug karne ke liye screenshot le lo
        try {
          await page.screenshot({ path: "error_screen.png", fullPage: true });
          console.log("📸 Screenshot saved as error_screen.png for debugging.");
        } catch(e) {}
      }
    }, 20000); // 20 Seconds interval

  } catch (err) {
    console.log("Browser error:", err.message);
    console.log("Restarting in 10 seconds...");
    if (browser) await browser.close();
    setTimeout(startWatcher, 10000);
  }
}

// Start watching!
startWatcher();

// ==============================
// SEND QUEUE PROCESSOR
// ==============================
// Har 15 seconds me queue se ek-ek karke Telegram par bhejega
setInterval(async () => {
  if (queue.length === 0) return;
  const user = queue.shift();
  await sendTelegram(user);
}, 15000);

// ==============================
// GLOBAL ERROR HANDLER
// ==============================
process.on("uncaughtException", (err) => {
  console.log("Uncaught:", err.message);
});

process.on("unhandledRejection", (err) => {
  console.log("Unhandled:", err?.message || err);
});