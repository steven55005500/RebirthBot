require("dotenv").config();
const puppeteer = require("puppeteer");

async function autoLogin(page) {
  try {

    const loginInput = await page.$("#txtusername");

    if (loginInput) {

      console.log("Session expired → Logging in...");

      await page.type("#txtusername", process.env.LOGIN_ID, { delay: 50 });
      await page.type("input[type=password]", process.env.LOGIN_PASS, { delay: 50 });

      await page.keyboard.press("Enter");

      await page.waitForTimeout(6000);

      console.log("LOGIN SUCCESS");

    } else {

      console.log("Already logged in");

    }

  } catch (err) {

    console.log("Login error:", err.message);

  }
}

(async () => {

  const browser = await puppeteer.launch({
    headless: true,
    userDataDir: "./profile",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage"
    ]
  });

  const page = await browser.newPage();

  await page.goto(
    "https://www.rebirthcharity.com/Report/AutoPoolTeam",
    { waitUntil: "networkidle2" }
  );

  await autoLogin(page);

  setInterval(async () => {

    try {

      await page.reload({ waitUntil: "networkidle2" });

      await autoLogin(page);

      console.log("Page refreshed & session checked");

    } catch (err) {

      console.log("Reload error:", err.message);

    }

  }, 300000);

})();