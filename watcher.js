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

const bot = new TelegramBot(BOT_TOKEN,{
 polling:true,
 filepath:false
});

let refreshLoop;
// ==============================
// CHANNEL JOIN WELCOME
// ==============================

bot.on("new_chat_members",(msg)=>{

const chatId = msg.chat.id;

msg.new_chat_members.forEach((user)=>{

const name = user.first_name || "User";

bot.sendMessage(
chatId,
`🎉 Welcome ${name} to Rebirth Charity!

🚀 We're excited to have you here.

Start your journey now 👇`,
{
reply_markup:{
inline_keyboard:[
[
{
text:"🚀 Open Rebirth Bot",
url:"https://t.me/Rebirth_Charity_bot?start=app"
}
]
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
reply_markup:{
inline_keyboard:[

[
{
text:"📱 Open Mini App",
web_app:{ url: MINI_APP_URL }
}
],

[
{
text:"🔓 Login from Browser",
url: MINI_APP_URL
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

try{

if(fs.existsSync("sent.json")){

const data = fs.readFileSync("sent.json","utf8");
knownIds = new Set(data ? JSON.parse(data) : []);

}

}catch{

console.log("sent.json reset");
fs.writeFileSync("sent.json","[]");

}

// ==============================
// SAVE IDS
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

try{

await axios.post(
`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
{
chat_id:CHAT_ID,
text:message,
parse_mode:"HTML",

reply_markup:{
inline_keyboard:[
[
{
text:"🚀 Join Rebirth Charity Now",
url:"https://t.me/Rebirth_Charity_bot?start=app"
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


async function safeReload(page){

while(true){

try{

await page.reload({
waitUntil:"domcontentloaded",
timeout:60000
});

return;

}catch(err){

console.log("Site unreachable → retrying in 15 seconds");

await new Promise(r=>setTimeout(r,15000));

}

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
args:[
"--no-sandbox",
"--disable-setuid-sandbox",
"--disable-dev-shm-usage",
"--disable-gpu"
]

});

browser.on("disconnected", () => {

console.log("Browser disconnected → restarting watcher");

clearInterval(refreshLoop);

setTimeout(startWatcher,5000);

});



const page = await browser.newPage();

await page.setDefaultNavigationTimeout(0);

// page crash
page.on("error", async () => {

console.log("Page crashed → restarting watcher");

try{
await browser.close();
}catch{}

setTimeout(startWatcher,5000);

});

// page javascript error
page.on("pageerror",(err)=>{
console.log("Page error:",err.message);
});


await page.goto(
"https://www.rebirthcharity.com/Report/AutoPoolTeam",
{
waitUntil:"domcontentloaded",
timeout:0
}
);

console.log("LIVE WATCH STARTED");

refreshLoop = setInterval(async()=>{

try{

await safeReload(page);

await new Promise(r=>setTimeout(r,3000));

const loginInput = await page.$("#txtusername");

if(loginInput){

console.log("Session expired → Logging in");

await page.click("#txtusername",{clickCount:3});
await page.keyboard.press("Backspace");

await page.type("#txtusername",process.env.LOGIN_ID,{delay:50});

await page.click("input[type=password]",{clickCount:3});
await page.keyboard.press("Backspace");

await page.type("input[type=password]",process.env.LOGIN_PASS,{delay:50});

await page.keyboard.press("Enter");

await page.waitForNavigation({
waitUntil:"domcontentloaded",
timeout:0
});

console.log("LOGIN SUCCESS");

}

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

if(err.message.includes("Execution context was destroyed")){
console.log("Page navigating... retrying");
return;
}

console.log("Fetch error:",err.message);

}

},20000);

}catch(err){

console.log("Watcher crash:",err);
console.log("Restarting watcher in 10 seconds...");

setTimeout(startWatcher,10000);

}

}

startWatcher();

// ==============================
// SEND QUEUE
// ==============================

setInterval(async()=>{

if(queue.length===0) return;

const user = queue.shift();

await sendTelegram(user);

},15000);

// ==============================
// GLOBAL ERROR HANDLER
// ==============================

process.on("uncaughtException",(err)=>{
console.log("Uncaught:",err.message);
});

process.on("unhandledRejection",(err)=>{
console.log("Unhandled:",err);
});
