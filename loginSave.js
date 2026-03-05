require("dotenv").config();
const puppeteer = require("puppeteer");

async function autoLogin(page){

try{

const loginInput = await page.$("#txtusername");

if(loginInput){

console.log("Session expired. Logging in again...");

await page.click("#txtusername",{clickCount:3});
await page.keyboard.press("Backspace");

await page.type("#txtusername",process.env.LOGIN_ID,{delay:50});

await page.click("input[type=password]",{clickCount:3});
await page.keyboard.press("Backspace");

await page.type("input[type=password]",process.env.LOGIN_PASS,{delay:50});

await page.keyboard.press("Enter");

await page.waitForNavigation({waitUntil:"networkidle2"});

console.log("LOGIN SUCCESS");

}else{

console.log("Already logged in");

}

}catch(err){

console.log("Login error:",err.message);

}

}

(async()=>{

const browser = await puppeteer.launch({

headless:true,
userDataDir:"./profile",
args:[
"--no-sandbox",
"--disable-setuid-sandbox",
"--disable-dev-shm-usage"
]

});

const page = await browser.newPage();

await page.goto(
"https://www.rebirthcharity.com/Report/AutoPoolTeam",
{waitUntil:"networkidle2"}
);

await autoLogin(page);

setInterval(async()=>{

await page.reload({waitUntil:"networkidle2"});

await autoLogin(page);

console.log("Session check done");

},300000);

})();