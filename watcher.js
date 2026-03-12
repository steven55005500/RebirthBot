require("dotenv").config();

const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

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

let queue = [];
let knownIds = new Set();

// load sent ids
if (fs.existsSync("sent.json")) {
  knownIds = new Set(JSON.parse(fs.readFileSync("sent.json")));
}

function saveIds() {
  fs.writeFileSync("sent.json", JSON.stringify([...knownIds], null, 2));
}

async function sendTelegram(user) {

  const flag = getFlagEmoji(user.country);
  const dateStr = new Date().toLocaleString("en-US");

  const message = `🚀 <b>REBIRTH CHARITY – NEW MEMBER</b>

👤 Name: ${user.name}
🆔 ID: ${user.id}
🌍 Country: ${flag} ${user.country}
💲 Donate: $30
⏰ ${dateStr}`;

  try {

    await bot.sendMessage(CHAT_ID, message, {
      parse_mode: "HTML",
      disable_web_page_preview: true
    });

    console.log("✅ Telegram Sent:", user.id);

  } catch (err) {

    console.log("Telegram Error:", err.message);

  }

}

const delay = (t) => new Promise(r => setTimeout(r, t));

async function startWatcher() {

  let browser;

  try {

    browser = await puppeteer.launch({

      headless: "new",

      args: [

        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-blink-features=AutomationControlled",
        "--window-size=1920,1080",

        "--proxy-server=http://31.59.20.176:6754"

      ],

      ignoreHTTPSErrors: true

    });

    const page = await browser.newPage();

    await page.authenticate({
      username: "uoopudbo",
      password: "y7jfgvy7l5f2"
    });

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
    );

    await page.setViewport({ width: 1920, height: 1080 });

    // hide automation
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
    });

    // faster loading
    await page.setRequestInterception(true);

    page.on("request", (req) => {

      const type = req.resourceType();

      if (
        type === "image" ||
        type === "font" ||
        type === "media" ||
        type === "stylesheet"
      ) {

        req.abort();

      } else {

        req.continue();

      }

    });

    console.log("🚀 WATCHER ACTIVE - Monitoring via Proxy");

    let retry = 0;

    while (true) {

      try {

        console.log("🔄 Checking for new members...");

        await page.goto(TARGET_URL, {

          waitUntil: "domcontentloaded",
          timeout: 45000

        });

        await page.waitForSelector(".member-card-row", { timeout: 30000 });

        const users = await page.$$eval(".member-card-row", rows =>
          rows.map(r => ({
            id: r.querySelector(".member-id-badge")?.innerText.replace("ID : ", "").trim(),
            name: r.querySelector(".member-name")?.innerText.trim(),
            country: r.querySelector(".member-country")?.innerText.trim()
          }))
        );

        console.log("Members Found:", users.length);

        for (const u of users) {

          if (u.id && !knownIds.has(u.id)) {

            knownIds.add(u.id);
            saveIds();

            queue.push(u);

            console.log("🆕 New Member:", u.id);

          }

        }

        retry = 0;

        await delay(15000);

      } catch (err) {

        retry++;

        console.log("⏳ Page Error:", err.message);

        if (retry >= 5) {

          console.log("⚠️ Restarting Browser...");

          await browser.close();

          startWatcher();

          return;

        }

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

// telegram queue
setInterval(async () => {

  if (queue.length > 0) {

    await sendTelegram(queue.shift());

  }

}, 3000);

process.on("uncaughtException", err => console.log("System Error:", err.message));
process.on("unhandledRejection", err => console.log("System Rejection:", err.message));