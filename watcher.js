require("dotenv").config();

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

const bot = new TelegramBot(BOT_TOKEN, { polling: true });


// ==============================
// START COMMAND
// ==============================

bot.onText(/\/start/, (msg) => {

 bot.sendMessage(
  msg.chat.id,
  "🚀 Welcome to Rebirth Charity\n\nOpen the login page below 👇",
  {
   reply_markup: {
    inline_keyboard: [
     [
      {
       text: "🔐 Open Login Page",
       web_app: { url: MINI_APP_URL }
      }
     ]
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

  const data = fs.readFileSync("sent.json","utf8");
  knownIds = new Set(data ? JSON.parse(data) : []);

 }

}catch{

 console.log("sent.json reset");
 fs.writeFileSync("sent.json","[]");

}


// ==============================
// SAVE IDS (limit size)
// ==============================

function saveIds(){

 const arr = [...knownIds];

 if(arr.length > 5000){

  const trimmed = arr.slice(-3000);
  knownIds = new Set(trimmed);

 }

 fs.writeFileSync(
  "sent.json",
  JSON.stringify([...knownIds],null,2)
 );

}


let queue = [];


// ==============================
// TELEGRAM SEND
// ==============================

async function sendTelegram(user){

 const flag = getFlagEmoji(user.country);

 const message = `
🚀🔥 <b>REBIRTH CHARITY NEW USER JOIN</b> 🔥🚀

━━━━━━━━━━━━━━━━━━━━

👤 <b>Name :</b> ${user.name}
🆔 <b>User ID :</b> <code>${user.id}</code>
🌍 <b>Country :</b> ${flag} ${user.country}

━━━━━━━━━━━━━━━━━━━━

⏰ <i>${new Date().toLocaleString()}</i>
`;

 try{

  await axios.post(
   `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
   {
    chat_id: CHAT_ID,
    text: message,
    parse_mode: "HTML",

    reply_markup:{
     inline_keyboard:[
      [
       {
        text:"🚀 Open Rebirth App",
        url:"https://t.me/Rebirth_Charity_bot"
       }
      ]
     ]
    }

   }
  );

  console.log("Sent:",user.id);

 }catch(err){

  console.log("Telegram Error:",err.message);

 }

}


// ==============================
// MAIN WATCHER
// ==============================

async function startWatcher(){

 try{

  const browser = await puppeteer.launch({

   headless:true,
   userDataDir:"./profile",
   args:["--no-sandbox","--disable-setuid-sandbox"]

  });

  const page = await browser.newPage();

  await page.goto(
   "https://www.rebirthcharity.com/Report/AutoPoolTeam",
   {waitUntil:"networkidle2"}
  );

  console.log("LIVE WATCH STARTED");


  setInterval(async()=>{

   try{

    await page.reload({waitUntil:"networkidle2"});

    console.log("Page refreshed");

    const users = await page.evaluate(()=>{

     const rows = document.querySelectorAll("table tbody tr");

     return [...rows].map(r=>({

      sr:r.children[0]?.innerText.trim(),
      country:r.children[2]?.innerText.trim(),
      id:r.children[3]?.innerText.trim(),
      name:r.children[4]?.innerText.trim()

     }));

    });

    users.sort((a,b)=>Number(b.sr)-Number(a.sr));

    for(const u of users){

     if(!u.id) continue;

     if(!knownIds.has(u.id)){

      knownIds.add(u.id);

      saveIds();

      queue.push(u);

      console.log("New:",u.id);

     }

    }

   }catch(err){

    console.log("Fetch error:",err.message);

   }

  },20000);

 }catch(err){

  console.log("Watcher crash, restarting...");
  setTimeout(startWatcher,10000);

 }

}

startWatcher();


// ==============================
// SEND QUEUE
// ==============================

setInterval(async()=>{

 if(queue.length === 0) return;

 const user = queue.shift();

 await sendTelegram(user);

},5000);


// ==============================
// GLOBAL ERROR HANDLER
// ==============================

process.on("uncaughtException",(err)=>{
 console.log("Uncaught:",err.message);
});

process.on("unhandledRejection",(err)=>{
 console.log("Unhandled:",err);
});