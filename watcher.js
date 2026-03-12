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

if (fs.existsSync("sent.json")) {
  knownIds = new Set(JSON.parse(fs.readFileSync("sent.json")));
}

function saveIds() {
  fs.writeFileSync("sent.json", JSON.stringify([...knownIds], null, 2));
}

async function sendTelegram(user) {

  const flag = getFlagEmoji(user.country);

  const message = `🚀 <b>NEW MEMBER JOINED</b>

👤 Name: ${user.name}
🆔 ID: ${user.id}
🌍 Country: ${flag} ${user.country}
💲 Donate: $30`;

  try {
    await bot.sendMessage(CHAT_ID, message, { parse_mode: "HTML" });
    console.log("✅ Sent:", user.id);
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
        "--window-size=1920,1080"
      ]
    });

    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
    );

    console.log("🚀 WATCHER ACTIVE");

    while (true) {

      try {

        console.log("🔄 Checking members...");

        await page.goto(TARGET_URL, {
          waitUntil: "domcontentloaded",
          timeout: 60000
        });

        await page.waitForSelector(".member-card-row", { timeout: 30000 });

        const users = await page.evaluate(() => {

          const cards = document.querySelectorAll(".member-card-row");

          return Array.from(cards).map(c => ({
            id: (c.querySelector(".member-id-badge")?.innerText || "").replace("ID : ", "").trim(),
            name: c.querySelector(".member-name")?.innerText.trim(),
            country: c.querySelector(".member-country")?.innerText.trim()
          }));

        });

        console.log("Members found:", users.length);

        for (const u of users) {

          if (u.id && !knownIds.has(u.id)) {

            knownIds.add(u.id);
            saveIds();

            queue.push(u);

            console.log("🆕 New Member:", u.id);

          }

        }

        await delay(30000);

      } catch (err) {

        console.log("Page Error:", err.message);
        await delay(15000);

      }

    }

  } catch (err) {

    console.log("Watcher Crash:", err.message);

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

process.on("uncaughtException", err => console.log("System Error:", err.message));
process.on("unhandledRejection", err => console.log("System Rejection:", err.message));