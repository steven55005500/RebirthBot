require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");

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

💎 ACTIVATE YOUR ID WITH ONLY $30 💎

🌍 Your ID will enter the GLOBAL POOL
⚡ Earn $60 within 24 Hours

🏆 TOTAL INCOME = $2520 IN 168 DAYS 🏆

🔥 Don't Waste Time
🎯 Join Today
🚀 Enter the Charity Help Program`;

async function sendMessages() {
  try {

    // Zoom Message
    await bot.sendMessage(CHAT_ID, message1);

    // Plan Message
    await bot.sendMessage(CHAT_ID, message2);

    // PDF with custom name
    await bot.sendDocument(
      CHAT_ID,
      {
        source: "./plan.pdf",
        filename: "REBIRTH_CHARITY.pdf"
      },
      {
        caption: "📄 REBIRTH CHARITY – FULL PLAN"
      }
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