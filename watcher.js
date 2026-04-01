require("dotenv").config();
require("./zoomReminder");

const puppeteer = require("puppeteer");
const axios = require("axios");
const fs = require("fs");
const TelegramBot = require("node-telegram-bot-api");

const getFlagEmoji = require("./src/utils/flag");

// ==============================
// CONFIG
// ==============================

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

const MINI_APP_URL = "https://www.rebirthcharity.com/Login/Login";

const bot = new TelegramBot(BOT_TOKEN, {
  polling: true,
  filepath: false
});

let refreshLoop;

// ==============================
// CHANNEL JOIN WELCOME
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

// ==============================
// START COMMAND
// ==============================

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
// LOAD IDS
// ==============================

let knownIds = new Set();

try {
  if (fs.existsSync("sent.json")) {
    const data = fs.readFileSync("sent.json", "utf8");
    knownIds = new Set(data ? JSON.parse(data) : []);
  }
} catch {
  console.log("sent.json reset");
  fs.writeFileSync("sent.json", "[]");
}

// ==============================
// SAVE IDS
// ==============================

function saveIds() {
  const arr = [...knownIds];
  if (arr.length > 5000) {
    const trimmed = arr.slice(-3000);
    knownIds = new Set(trimmed);
  }
  fs.writeFileSync("sent.json", JSON.stringify([...knownIds], null, 2));
}

let queue = [];

// ==============================
// TELEGRAM SEND
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
⏰ <b>Date:</b> ${new Date().toLocaleDateString()}

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
    console.log("Sent:", user.id);
  } catch (err) {
    console.log("Telegram Error:", err.message);
  }
}

async function safeReload(page) {
  while (true) {
    try {
      await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
      return;
    } catch (err) {
      console.log("Site unreachable → retrying in 15 seconds");
      await new Promise(r => setTimeout(r, 15000));
    }
  }
}

// ==============================
// MAIN WATCHER
// ==============================

async function startWatcher() {
  try {
    const browser = await puppeteer.launch({
      headless: true,
      userDataDir: "./profile",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu"
      ]
    });

    browser.on("disconnected", () => {
      console.log("Browser disconnected → restarting watcher");
      clearInterval(refreshLoop);
      setTimeout(startWatcher, 5000);
    });

    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(0);

    // page crash
    page.on("error", async () => {
      console.log("Page crashed → restarting watcher");
      try { await browser.close(); } catch {}
      setTimeout(startWatcher, 5000);
    });

    // page javascript error
    page.on("pageerror", (err) => {
      console.log("Page error:", err.message);
    });

    // CHANGED URL TO GLOBAL TEAM PAGE
    await page.goto("https://www.rebirthcharity.com/Home/GlobalTeam", {
      waitUntil: "domcontentloaded",
      timeout: 0
    });

    console.log("LIVE WATCH STARTED (NO LOGIN REQUIRED)");

    refreshLoop = setInterval(async () => {
      try {
        await safeReload(page);
        await new Promise(r => setTimeout(r, 3000));

        console.log("Page refreshed");

        // SMART TEXT PARSER - Extracts data without needing exact HTML tags
        const users = await page.evaluate(() => {
          // Finds all container blocks on the page (like cards or rows)
          const elements = document.querySelectorAll("div.card, table tbody tr, div[class*='row'], div[style*='border'], div[class*='box']");
          const results = [];

          for (const el of elements) {
            const text = el.innerText || "";
            // Only process blocks that have an ID in them
            if (!text.includes("ID :")) continue;

            const idMatch = text.match(/ID\s*:\s*(\d+)/);
            const id = idMatch ? idMatch[1] : null;

            if (!id) continue;

            // Split the text into an array of lines to extract Name and Country
            const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

            let name = "Unknown";
            let country = "Unknown";

            // Loop through the lines to figure out where Name and Country are placed
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].includes("ID :")) {
                // The country is usually the line right before the ID
                if (i >= 1 && !lines[i-1].includes("PM") && !lines[i-1].includes("AM") && !lines[i-1].match(/^\d+$/)) {
                  country = lines[i-1];
                }
                // The name is usually the line right above the country
                if (i >= 2 && !lines[i-2].includes("PM") && !lines[i-2].includes("AM") && !lines[i-2].match(/^\d+$/)) {
                  name = lines[i-2];
                }
              }
            }

            // Ensure we don't accidentally add duplicates from nested HTML tags
            if (!results.find(u => u.id === id)) {
              results.push({ id, name, country });
            }
          }
          return results;
        });

        // Reverse the array so we process the oldest from the current page first
        users.reverse();

        for (const u of users) {
          if (!u.id) continue;
          if (!knownIds.has(u.id)) {
            knownIds.add(u.id);
            saveIds();
            queue.push(u);
            console.log("New User Found:", u.id, " | ", u.name, " | ", u.country);
          }
        }

      } catch (err) {
        if (err.message.includes("Execution context was destroyed")) {
          console.log("Page navigating... retrying");
          return;
        }
        console.log("Fetch error:", err.message);
      }
    }, 20000);

  } catch (err) {
    console.log("Watcher crash:", err);
    console.log("Restarting watcher in 10 seconds...");
    setTimeout(startWatcher, 10000);
  }
}

startWatcher();

// ==============================
// SEND QUEUE
// ==============================

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
  console.log("Unhandled:", err);
});