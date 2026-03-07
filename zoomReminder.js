require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");

const bot = new TelegramBot(process.env.BOT_TOKEN);
const CHAT_ID = process.env.CHAT_ID;

const message1 = `🌍 REBIRTH CHARITY – GRAND GLOBAL ZOOM MEETING 🌍

🚀 Today is the Grand Launch of Our Global Zoom Meeting!

📅 Daily Zoom Meeting
⏰ Join Sharp at 09:00 PM (India Time)

🌎 International Time Schedule
🇮🇳 India – 9:00 PM
🇦🇪 Dubai – 7:30 PM
🇧🇩 Bangladesh – 9:30 PM
🇱🇰 Sri Lanka – 9:00 PM
🇵🇰 Pakistan – 8:30 PM
🇬🇧 United Kingdom – 3:30 PM
🇺🇸 USA (New York) – 10:30 AM

🔗 Join Zoom Meeting:
https://us06web.zoom.us/j/84797175150?pwd=SkE1ZnwwHEKUykSHPUtUYspVXcxopO.1

🆔 Meeting ID: 847 9717 5150
🔑 Passcode: 12345

🚀 Be On Time • Learn • Grow • Succeed
🌟 REBIRTH CHARITY – Together We Rise!`;

const message2 = `🚀🚀🚀 HELLO REBIRTH CHARITY MEMBERS 🚀🚀🚀

💼 OUR TYPES OF EARNING
1️⃣ 50% DIRECT EARNING
When a direct member joins under you, you receive $15 instantly.

2️⃣ 20 LEVEL TEAM EARNING
Earn 1% commission from each level up to 20 levels.

3️⃣ GLOBAL TEAM EARNING
Receive $60 within 24 hours from the Global Pool.

4️⃣ CHARITY HELP EARNING
Earn up to $2520 in 168 Days.

5️⃣ ROYALTY EARNING
✔ Join 15 Direct Members in 10 Days – Earn $4.5 Daily
✔ Join 30 Direct Members in 10 Days – Earn $9 Daily

━━━━━━━━━━━━━━━━━━━━
💎 ACTIVATE YOUR ID WITH ONLY $30 💎

🔥 After activating with $30
🌍 Your ID will enter the GLOBAL POOL
⚡ You can earn $60 within 24 Hours

👥 Only 4 Direct Referrals Required
💰 Income from 4 Directs = $60
💵 Total Starting Income = $120

Once you complete 4 Direct Referrals, your ID will automatically enter the Charity Help Program.

After entering the Charity Program, you will receive an additional $120 Charity Earning within 3 days.

💰 Total Income in 3 Days = $240

━━━━━━━━━━━━━━━━━━━━
🌟 CHARITY HELP PROGRAM 🌟

🟢 LEVEL 1 – $40
⏳ After 3 Days
💸 Receive $120 Help from 3 Members
➡️ 1 Direct Required
➡️ Withdraw $40
➡️ $80 Auto Upgrade to Level 2

━━━━━━━━━━━━━━━━━━━━
🔵 LEVEL 2 – $80
⏳ After 15 Days
💸 Receive $240 Help from 3 Members
➡️ 1 Direct Required
➡️ Withdraw $80
➡️ $160 Auto Upgrade to Level 3

━━━━━━━━━━━━━━━━━━━━
🟡 LEVEL 3 – $160
⏳ After 30 Days
💸 Receive $480 Help from 3 Members
➡️ 1 Direct Required
➡️ Withdraw $160
➡️ $320 Auto Upgrade to Level 4

━━━━━━━━━━━━━━━━━━━━
🟣 LEVEL 4 – $320
⏳ After 30 Days
💸 Receive $960 Help from 3 Members
➡️ 1 Direct Required
➡️ Withdraw $320
➡️ $640 Auto Upgrade to Level 5

━━━━━━━━━━━━━━━━━━━━
🔴 LEVEL 5 – $640
⏳ After 30 Days
💸 Receive $1920 Help from 3 Members
➡️ 1 Direct Required
➡️ Withdraw $640
➡️ $1280 Charity Distribution

━━━━━━━━━━━━━━━━━━━━
🏆 LEVEL 6 – $1280
⏳ After 60 Days
💸 Receive $3840 Help from 3 Members
➡️ 1 Direct Required
➡️ Withdraw $1280
➡️ $2560 Charity Distribution

━━━━━━━━━━━━━━━━━━━━
🏆 TOTAL INCOME = $2520 IN 168 DAYS 🏆

🔥 Don't Waste Time
🎯 Join Today
👑 Complete 4 Direct Referrals
🚀 Enter the Charity Help Program`;

async function sendMessages() {
  try {

    await bot.sendMessage(CHAT_ID, message1);

    await new Promise(r => setTimeout(r, 2000));

    await bot.sendMessage(CHAT_ID, message2);

    await new Promise(r => setTimeout(r, 2000));

    await bot.sendDocument(
      CHAT_ID,
      fs.createReadStream("./REBIRTH_CHARITY.pdf"),
     
    );

    console.log("Zoom + Plan message sent");

  } catch (err) {
    console.log("Error:", err.message);
  }
}

// Bot start hote hi message
sendMessages();

// Har 15 minute me repeat
setInterval(sendMessages, 15 * 60 * 1000);