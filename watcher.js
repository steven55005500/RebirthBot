require("dotenv").config();
const puppeteer = require("puppeteer");
const axios = require("axios");
const fs = require("fs");
const TelegramBot = require("node-telegram-bot-api");

// Flag utility
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
const MINI_APP_URL = "https://www.rebirthcharity.com/Login/Login";
const TARGET_URL = "https://www.rebirthcharity.com/Report/AutoPoolTeam";

const bot = new TelegramBot(BOT_TOKEN, { polling: true, filepath: false });

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
        knownIds = new Set(arr.slice(-3000));
    }
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

💰 <i>Start your journey and grow with our Rebirth charity community.</i>
━━━━━━━━━━━━━━━━━━
🔥 <b>More leaders are joining every day!</b>
🚀 <b>Don't miss the opportunity – Join Now!</b>
`;

    try {
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            chat_id: CHAT_ID,
            text: message,
            parse_mode: "HTML",
            reply_markup: {
                inline_keyboard: [[{ text: "🚀 Join Rebirth Charity Now", url: "https://t.me/Rebirth_Charity_bot?start=app" }]]
            }
        });
        console.log("✅ Sent ID to Telegram:", user.id);
    } catch (err) {
        console.log("Telegram Error:", err.message);
    }
}

// ==============================
// MAIN WATCHER (Fixed with While Loop)
// ==============================

async function startWatcher() {
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: true,
            userDataDir: "./profile_watcher",
            args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
        });

        const page = await browser.newPage();
        page.setDefaultNavigationTimeout(0);

        console.log("🚀 WATCHER STARTED");

        // INFINITE LOOP: No more setInterval overlap!
        while (true) {
            try {
                console.log("🔄 Navigating to Target Page...");
                await page.goto(TARGET_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
                
                // Check if login is needed
                const loginInput = await page.$("#txtusername");
                if (loginInput) {
                    console.log("🔑 Session expired → Logging in...");
                    await page.type("#txtusername", process.env.LOGIN_ID, { delay: 50 });
                    await page.type("input[type=password]", process.env.LOGIN_PASS, { delay: 50 });
                    await Promise.all([
                        page.waitForNavigation({ waitUntil: "domcontentloaded" }),
                        page.keyboard.press("Enter")
                    ]);
                    console.log("✅ LOGIN SUCCESS");
                    await page.goto(TARGET_URL, { waitUntil: "domcontentloaded" });
                }

                // Scrape IDs
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

                users.sort((a, b) => Number(b.sr) - Number(a.sr));

                for (const u of users) {
                    if (u.id && !knownIds.has(u.id)) {
                        knownIds.add(u.id);
                        saveIds();
                        queue.push(u);
                        console.log("🆕 New User Found:", u.id);
                    }
                }
                console.log("💤 Round finished. Sleeping for 25 seconds...");

            } catch (err) {
                console.log("⚠️ Loop Error:", err.message);
                try { await page.screenshot({ path: "error_screen.png" }); } catch (e) {}
            }
            
            // Wait 25 seconds before next round
            await new Promise(r => setTimeout(r, 25000));
        }

    } catch (err) {
        console.log("❌ Fatal Browser Error:", err.message);
        if (browser) await browser.close();
        setTimeout(startWatcher, 10000);
    }
}

// Start
startWatcher();

// Telegram Queue Processor (Every 15s)
setInterval(async () => {
    if (queue.length > 0) {
        const user = queue.shift();
        await sendTelegram(user);
    }
}, 15000);

// Global Handlers
process.on("uncaughtException", (err) => console.log("Uncaught:", err.message));
process.on("unhandledRejection", (err) => console.log("Unhandled:", err));