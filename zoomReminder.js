require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
const cron = require("node-cron");

const bot = new TelegramBot(process.env.BOT_TOKEN);
const CHAT_ID = process.env.CHAT_ID;

const message1 = `🌍 REBIRTH CHARITY – DAILY ZOOM MEETING 🌍

📅 Daily Zoom Meeting
⏰ Join Sharp at 09:30 PM (India Time)

🌎 International Time Schedule

🇮🇳 India – 9:30 PM
🇦🇪 Dubai – 8:00 PM
🇧🇩 Bangladesh – 10:00 PM
🇱🇰 Sri Lanka – 9:30 PM
🇵🇰 Pakistan – 9:00 PM
🇬🇧 United Kingdom – 4:00 PM
🇺🇸 USA (New York) – 11:00 AM

🔗 Join Zoom Meeting:
https://us06web.zoom.us/j/84797175150?pwd=SkE1ZnwwHEKUykSHPUtUYspVXcxopO.1

🆔 Meeting ID: 847 9717 5150  
🔑 Passcode: 12345  

🚀 Be On Time • Learn • Grow • Succeed  

🌟 REBIRTH CHARITY – Together We Rise!`;

const message2 = `🔥🚀 REBIRTH CHARITY – OFFICIAL EARNING PLAN 🚀🔥
━━━━━━━━━━━━━━━━━━━━━━
💼 OUR TYPES OF EARNING

━━━━━━━━━━━━━━━━━━━━━━

💰 1. DIRECT EARNING (50%)
➤ Earn $15 instantly for every direct referral

━━━━━━━━━━━━━━━━━━━━━━

🌐 2. 20 LEVEL TEAM EARNING
➤ Get 1% commission from each level (up to 20 levels)

━━━━━━━━━━━━━━━━━━━━━━

⚡ 3. GLOBAL POOL EARNING
➤ Earn $60 within 24 hours

━━━━━━━━━━━━━━━━━━━━━━

🎯 4. CHARITY HELP EARNING
➤ Earn up to $2520 in 168 Days

━━━━━━━━━━━━━━━━━━━━━━

👑 5. ROYALTY INCOME
✔ 15 Directs in 10 Days → $4.5 Daily
✔ 30 Directs in 10 Days → $9 Daily

━━━━━━━━━━━━━━━━━━━━━━

💼 6. DAILY SALARY INCOME

🥉 Rank 1
➤ 5 Direct | 50 Team → $1 Daily

🥈 Rank 2
➤ 10 Direct | 250 Team → $5 Daily

🥇 Rank 3
➤ 20 Direct | 1200 Team → $10 Daily

🏆 Rank 4
➤ 30 Direct | 5000 Team → $25 Daily

👑 Rank 5
➤ 50 Direct | 10000 Team → $50 Daily

━━━━━━━━━━━━━━━━━━━━━━

💎 ACTIVATE WITH JUST $30 💎
🌍 Enter GLOBAL POOL
⚡ Earn $60 within 24 Hours

━━━━━━━━━━━━━━━━━━━━━━
🌟 CHARITY HELP PROGRAM 🌟
🟢 LEVEL 1 – $40
⏳ 3 Days → Receive $120
💸 Withdraw $40 | 🔁 $80 Upgrade


🔵 LEVEL 2 – $80
⏳ 15 Days → Receive $240
💸 Withdraw $80 | 🔁 $160 Upgrade


🟡 LEVEL 3 – $160
⏳ 30 Days → Receive $480
💸 Withdraw $160 | 🔁 $320 Upgrade


🟣 LEVEL 4 – $320
⏳ 30 Days → Receive $960
💸 Withdraw $320 | 🔁 $640 Upgrade


🔴 LEVEL 5 – $640
⏳ 30 Days → Receive $1920
💸 Withdraw $640 | 🔁 Upgrade 


🏆 LEVEL 6 – $1280
⏳ 60 Days → Receive $3840
💸 Withdraw $1280 | 🎁 Charity Distribution
━━━━━━━━━━━━━━━━━━━━━━
🏆 TOTAL INCOME: $2520 IN 168 DAYS 🏆



🔥 Don’t Miss This Opportunity
🎯 Start Your Journey Today
🚀 Join Now & Grow Your Income`;

// ==========================================
// SCHEDULER LOGIC (INDIA TIME)
// ==========================================

// 1. Message 1: Har 15 minute me (Sham 7:00 PM se 9:45 PM tak)
cron.schedule('*/15 19-21 * * *', async () => {
  try {
    await bot.sendMessage(CHAT_ID, message1);
    console.log("Zoom message sent (15-min interval)");
  } catch (err) {
    console.log("Error:", err.message);
  }
}, {
  timezone: "Asia/Kolkata"
});

// 2. Message 1: Raat 10:00 PM ke liye exact time
cron.schedule('0 22 * * *', async () => {
  try {
    await bot.sendMessage(CHAT_ID, message1);
    console.log("Zoom message sent (Exact 10:00 PM)");
  } catch (err) {
    console.log("Error:", err.message);
  }
}, {
  timezone: "Asia/Kolkata"
});

// 3. Message 2 & PDF: Har 1 ghante me (Bot start hone ke baad se)
async function sendPlanAndPdf() {
  try {
    await bot.sendMessage(CHAT_ID, message2);
    await new Promise(r => setTimeout(r, 2000));
    await bot.sendDocument(CHAT_ID, fs.createReadStream("./REBIRTH_CHARITY.pdf"));
    console.log("Plan message and PDF sent");
  } catch (err) {
    console.log("Error:", err.message);
  }
}

// Bot start hote hi ek baar Plan aur PDF bhej dega
sendPlanAndPdf();

// Fir har 1 ghante (60 mins) me bhejne ke liye
setInterval(sendPlanAndPdf, 60 * 60 * 1000);

console.log("Bot started. Scheduler is running...");