require("dotenv").config();
const puppeteer = require("puppeteer");

(async () => {

const browser = await puppeteer.launch({
headless: true,
userDataDir: "./profile",
defaultViewport: null,
args: [
"--no-sandbox",
"--disable-setuid-sandbox",
"--disable-dev-shm-usage"
]
});

const page = await browser.newPage();

await page.goto(
"https://www.rebirthcharity.com/Login/Login",
{ waitUntil: "networkidle2" }
);

// USERNAME
await page.waitForSelector("#txtusername");
await page.type("#txtusername", process.env.LOGIN_ID);

// PASSWORD
await page.waitForSelector("input[type=password]");
await page.type(
"input[type=password]",
process.env.LOGIN_PASS
);

// PRESS ENTER
await page.keyboard.press("Enter");

await page.waitForNavigation({
waitUntil: "networkidle2"
});

console.log("LOGIN SUCCESS");

// browser close optional
// await browser.close();

})();
