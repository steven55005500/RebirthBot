require("dotenv").config();
const puppeteer = require("puppeteer");

async function autoLogin(page){

try{

// check if login form exists
const loginInput = await page.$("#txtusername");

if(loginInput){

console.log("Session expired. Logging in again...");

// username
await page.type("#txtusername", process.env.LOGIN_ID,{delay:50});

// password
await page.type("input[type=password]", process.env.LOGIN_PASS,{delay:50});

// press enter
await page.keyboard.press("Enter");

// wait navigation
await page.waitForNavigation({waitUntil:"networkidle2"});

console.log("LOGIN SUCCESS");

}else{

console.log("Already logged in");

}

}catch(err){

console.log("Login error:",err.message);

}

}

(async () => {

const browser = await puppeteer.launch({

headless:true,
userDataDir:"./profile",
defaultViewport:null,
args:[
"--no-sandbox",
"--disable-setuid-sandbox",
"--disable-dev-shm-usage"
]

});

const page = await browser.newPage();

// open login page
await page.goto(
"https://www.rebirthcharity.com/Login/Login",
{waitUntil:"networkidle2"}
);

// auto login check
await autoLogin(page);

// keep checking session every 5 minutes
setInterval(async()=>{

await page.goto(
"https://www.rebirthcharity.com/Report/AutoPoolTeam",
{waitUntil:"networkidle2"}
);

await autoLogin(page);

console.log("Session check done");

},300000); // 5 min

})();
