require("dotenv").config();
const puppeteer = require("puppeteer");

async function autoLogin(page){
  try{

    const loginInput = await page.$("#txtusername");

    if(loginInput){

      console.log("Session expired → Logging in...");

      await page.click("#txtusername",{clickCount:3});
      await page.keyboard.press("Backspace");
      await page.type("#txtusername",process.env.LOGIN_ID,{delay:50});

      await page.click("input[type=password]",{clickCount:3});
      await page.keyboard.press("Backspace");
      await page.type("input[type=password]",process.env.LOGIN_PASS,{delay:50});

      await page.keyboard.press("Enter");

      await new Promise(r=>setTimeout(r,7000));

      console.log("LOGIN SUCCESS");

    }else{

      console.log("Session active");

    }

  }catch(err){
    console.log("Login error:",err.message);
  }
}

async function start(){

  let browser;

  try{

browser = await puppeteer.launch({
  headless: true,
  userDataDir: "./profile",
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--disable-crash-reporter",
    "--disable-blink-features=AutomationControlled"
  ],
  defaultViewport: null
});

    const page = await browser.newPage();

    page.setDefaultNavigationTimeout(0);

    await page.goto(
      "https://www.rebirthcharity.com/Report/AutoPoolTeam",
      {
         waitUntil:"networkidle2",
        timeout:0
      }
    );

    console.log("WATCHER STARTED");

    await autoLogin(page);

    setInterval(async()=>{

      try{

        await page.reload({
          waitUntil:"domcontentloaded",
          timeout:0
        });

        await autoLogin(page);

        console.log("Page refreshed & session checked");

      }catch(err){

        console.log("Reload error:",err.message);

      }

    },300000); // 5 minutes

    // Internet error recovery
    page.on("error",async()=>{
      console.log("Page crashed → restarting browser");
      await browser.close();
      start();
    });

  }catch(err){

    console.log("Browser error:",err.message);
    console.log("Restarting in 10 seconds...");

    if(browser) await browser.close();

    setTimeout(start,10000);

  }
}

start();