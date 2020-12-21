require("dotenv").config({ path: __dirname + "/.env" });
const puppeteer = require("puppeteer-extra");
const RecaptchaPlugin = require("puppeteer-extra-plugin-recaptcha");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const AdblockerPlugin = require("puppeteer-extra-plugin-adblocker");
const path = require("path");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require(path.join(__dirname, "models/User"));
const { app, BrowserWindow, Menu, ipcMain, remote, dialog, session } = require("electron");
const fs = require("fs");
const parse = require("csv-parse");
const WindowsToaster = require("node-notifier").WindowsToaster;
const myFunc = require(path.join(__dirname, "./src/windowRenderer"));
const { autoUpdater } = require("electron-updater");
const log = require("electron-log");
const getmac = require("getmac");
const publicIp = require("public-ip");
const logger = require("./helpers/logger");
const common = require("./helpers/common");
// const mainProcessed = require("./MainProcess");

puppeteer.use(
  RecaptchaPlugin({
    provider: { id: "2captcha", token: process.env.CAPTCHA_KEY },
    visualFeedback: true,
  })
);
puppeteer.use(AdblockerPlugin());
puppeteer.use(StealthPlugin());

let mainWindow, homeWindow, uploadWindow, importWindow, updateWindow, adminWindow, editUserWindow;

let publicIPObj = {},
  loggerObj = {};

const dbConnectionStr =
  process.env.NODE_ENV !== "development" ? process.env.PRODUCTION_DB2 : process.env.REMOTE_DB;
// const dbConnectionStr =
//   process.env.NODE_ENV !== "development" ? process.env.REMOTE_DB : process.env.PRODUCTION_DB2;

//--------------------------------------------------------------------
// AUTO UPDATE
//--------------------------------------------------------------------
autoUpdater.on("checking-for-update", () => {
  updateWindow.webContents.send("msg-update", "Checking for update...");
});
autoUpdater.on("update-available", (info) => {
  updateWindow.webContents.send("msg-update", "Update available");
});
autoUpdater.on("update-not-available", (info) => {
  updateWindow.webContents.send("msg-update", "You are using the latest version");
  setTimeout(() => {
    createWindow();
    updateWindow.close();
  }, 1000);
});
autoUpdater.on("error", (err) => {
  updateWindow.webContents.send("msg-update", "Error in auto-updater. " + err);
});
autoUpdater.on("download-progress", (progressObj) => {
  updateWindow.webContents.send("msg-update", "Downloading update...");
  updateWindow.webContents.send("download-progress", Math.round(progressObj.percent));
});
autoUpdater.on("update-downloaded", (info) => {
  updateWindow.webContents.send("msg-update", "Update downloaded...Install in 3s");
  setTimeout(() => {
    autoUpdater.quitAndInstall();
  }, 3000);
});

//--------------------------------------------------------------------
// CREATE WINDOWS
//--------------------------------------------------------------------
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 500,
    height: 500,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      enableRemoteModule: true,
    },
  });
  mainWindow.loadURL(path.join(__dirname, `./views/login.html#v${app.getVersion()}`));
  mainWindow.on("closed", function () {
    mainWindow = null;
  });
  // Connect to MongoDB
  setTimeout(() => {
    connectDB(dbConnectionStr);
  }, 1000);

  const ip_adds = (async () => {
    publicIPObj.ip = await publicIp.v4();
    let mac = getmac.default().toUpperCase();
    loggerObj = {
      ip_address: publicIPObj.ip,
      MAC: mac,
      app_name: "Displate",
    };
  })();
  const mainMenu = Menu.buildFromTemplate(myFunc.mainMenuTemplate(app));
  Menu.setApplicationMenu(mainMenu);
}

function createHomeWindow() {
  homeWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    resizable: false,
    darkTheme: true,
    title: "Displate Upload Tool",
    webPreferences: {
      nodeIntegration: true,
      enableRemoteModule: true,
    },
  });
  homeWindow.removeMenu();
  homeWindow.loadFile("./views/home.html");
  homeWindow.on("close", function () {
    homeWindow = null;
  });
  const mainMenu = Menu.buildFromTemplate(myFunc.mainMenuTemplate(app));
  Menu.setApplicationMenu(mainMenu);
}

function createAdminWindow() {
  adminWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    resizable: false,
    darkTheme: true,
    title: "Displate Tools - Admin Panel",
    webPreferences: {
      nodeIntegration: true,
      enableRemoteModule: true,
    },
  });
  // adminWindow.webContents.openDevTools();
  adminWindow.removeMenu();
  adminWindow.loadFile("./views/admin.html");
  adminWindow.on("close", function () {
    adminWindow = null;
  });
  const mainMenu = Menu.buildFromTemplate(myFunc.mainMenuTemplate(app));
  Menu.setApplicationMenu(mainMenu);
}

function createUpdateWindow() {
  updateWindow = new BrowserWindow({
    width: 400,
    height: 150,
    resizable: false,
    darkTheme: true,
    title: "Displate Upload Tool",
    webPreferences: {
      nodeIntegration: true,
      enableRemoteModule: true,
    },
  });
  updateWindow.removeMenu();
  updateWindow.loadFile("./views/checkupdate.html");
  updateWindow.on("close", function () {
    updateWindow = null;
  });
}

function createUploadWindow() {
  uploadWindow = new BrowserWindow({
    width: 1024,
    height: 900,
    resizable: false,
    darkTheme: true,
    title: "Displate Upload Tool",
    webPreferences: {
      nodeIntegration: true,
      enableRemoteModule: true,
    },
    parent: homeWindow,
  });
  uploadWindow.removeMenu();
  uploadWindow.loadFile("./views/upload.html");
  uploadWindow.on("close", function () {
    uploadWindow = null;
  });
  const mainMenu = Menu.buildFromTemplate(myFunc.mainMenuTemplate(app));
  Menu.setApplicationMenu(mainMenu);
}

function createImportWindow() {
  importWindow = new BrowserWindow({
    width: 600,
    height: 600,
    resizable: false,
    darkTheme: true,
    title: "Displate Upload Tool",
    webPreferences: {
      nodeIntegration: true,
      enableRemoteModule: true,
    },
    parent: homeWindow,
  });
  importWindow.removeMenu();
  importWindow.loadFile("./views/import.html");
  importWindow.on("close", function () {
    importWindow = null;
  });
}

function createEditUserWindow() {
  editUserWindow = new BrowserWindow({
    width: 500,
    height: 580,
    resizable: false,
    darkTheme: true,
    title: "Displate Upload Tool",
    webPreferences: {
      nodeIntegration: true,
      enableRemoteModule: true,
    },
    parent: adminWindow,
  });
  editUserWindow.removeMenu();
  editUserWindow.loadFile("./views/edituser.html");
  editUserWindow.on("close", function () {
    editUserWindow = null;
  });
}

function connectDB(dbConnectionStr) {
  mongoose
    .connect(dbConnectionStr, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => {
      mainWindow.webContents.send("db", "connected");
      console.log("MongoDB Connected");
    })
    .catch((err) => {
      log.error(err);
      mainWindow.webContents.send("db", "failed");
    });
}

//--------------------------------------------------------------------
// On ready
//--------------------------------------------------------------------
if (process.env.NODE_ENV === "development") {
  app.on("ready", createWindow);
} else {
  app.on("ready", createUpdateWindow);
}
app.on("ready", function () {
  autoUpdater.checkForUpdatesAndNotify();
});
app.on("window-all-closed", function () {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", function () {
  if (mainWindow === null) {
    createWindow();
  }
});

//Auth user
ipcMain.on("auth-form", function (e, item) {
  username = item["username"];
  password = item["password"];

  User.findOne({
    username: username,
  }).then((user) => {
    if (!user) {
      mainWindow.webContents.send("msg-login", "user-failed");
      return;
    }
    // Match password
    bcrypt.compare(password, user.password, (err, isMatch) => {
      if (err) log.error(err);
      if (isMatch) {
        if (user.roles == "ADMIN") {
          loggerObj.user_name = user.username;
          createAdminWindow();
          mainWindow.close();
        } else {
          if (typeof user.mac != "undefined") {
            let userMac = user.mac.toUpperCase().replaceAll("-", ":");
            if (getmac.default().toUpperCase() == userMac) {
              if (typeof user.ip1 != "undefined" || typeof user.ip2 != "undefined") {
                if (publicIPObj.ip == user.ip1 || publicIPObj.ip == user.ip2) {
                  session.defaultSession.cookies.set({
                    url: "http://localhost",
                    name: user.name,
                  });
                  loggerObj.user_name = user.username;
                  createHomeWindow();
                  mainWindow.close();
                } else {
                  mainWindow.webContents.send("msg-login", "wrong-ip");
                  return;
                }
              }
            } else {
              mainWindow.webContents.send("msg-login", "wrong-mac");
              return;
            }
          } else {
            mainWindow.webContents.send("msg-login", "wrong-mac");
            return;
          }
        }
      } else {
        mainWindow.webContents.send("msg-login", "pass-failed");
        return;
      }
    });
  });
});

var arrAcc = {};
// Handle select button click
ipcMain.on("select-clicked", function (e, arrItems) {
  createUploadWindow();
  arrAcc = arrItems;
});

ipcMain.on("import-clicked", function (e, item) {
  createImportWindow();
});

ipcMain.on("import-success", function (e, item) {
  importWindow.hide();
  homeWindow.webContents.send("reload-acc-info", "reload");
});

// Handle upload button click
ipcMain.on("upload-clicked", function (e, arrItems) {
  try {
    mainProcess(arrAcc, arrItems);
  } catch (err) {
    log.error(err);
    loogger.error(err.stack, loggerObj);
  }
  uploadWindow.close();
});

ipcMain.on("edit-user", function (e, userInfo) {
  createEditUserWindow();
  setTimeout(() => {
    editUserWindow.webContents.send("data", userInfo);
  }, 1000);
});

ipcMain.on("delete-user", function (e, username) {
  User.findOneAndDelete({
    username: username,
  }).then((user) => {
    if (!user) {
      return;
    }
    adminWindow.webContents.send("user-modified", "true");
  });
});

ipcMain.on("data-modified", function (e, data) {
  User.findOneAndUpdate(
    {
      username: data.username,
    },
    { $set: data },
    {
      useFindAndModify: false,
    }
  ).then((user) => {
    if (!user) {
      return;
    }
    adminWindow.webContents.send("user-modified", "true");
  });
});

ipcMain.on("logout", function (e, item) {
  createWindow();
  if (item == "logoutAdmin") {
    adminWindow.close();
  } else if (item == "logout") {
    homeWindow.close();
  }
});

ipcMain.on("open-account", function (e, data) {
  try {
    openAccount(data);
  } catch (err) {
    log.error(err);
    logger.error(err.stack, loggerObj);
  }
});

async function mainProcess(arrAcc, arrItems) {
  try {
    const accUsername = arrAcc[0];
    const accPassword = arrAcc[1];
    const proxyIP = arrAcc[2];
    const proxyUser = arrAcc[3];
    const proxyPass = arrAcc[4];
    const arrImgPath = arrItems[0];
    const imgType = arrItems[2];
    const arrCategory = arrItems[3];
    const regexStr = /([^\\]+)(?=\.\w+$)/;

    // Read tag
    let tagListArr = [];
    let arrTags = [];
    let tagNameVal = arrItems[1].split(",");
    let nicheVal = tagNameVal[0].trim();
    let subNicheVal = tagNameVal[1].trim();
    let nicheIndex = 0;
    let nextNicheIndex = 0;
    const tagsPath =
      process.env.NODE_ENV === "development"
        ? "./data/tags.csv"
        : path.join(process.resourcesPath, "data/tags.csv");
    fs.readFile(tagsPath, function (err, data) {
      if (err) {
        log.error(err);
        logger.error(err.stack, loggerObj);
      }
      parse(data, { columns: false, trim: true }, function (err, rows) {
        if (err) {
          log.error(err);
          logger.error(err.stack, loggerObj);
        }
        for (let index = 1; index < rows.length; index++) {
          const element = rows[index];
          if (element[0].toUpperCase().trim() == nicheVal.toUpperCase()) {
            nicheIndex = index;
            continue;
          }
          if (element[0] != "" && index > nicheIndex && nicheIndex != 0) {
            nextNicheIndex = index;
            break;
          }
        }
        if (nextNicheIndex == 0 && nicheIndex != 0) {
          for (let index = 1; index < rows.length; index++) {
            const element = rows[index];
            if (element[1].toUpperCase().trim() == subNicheVal.toUpperCase()) {
              arrTags.push(element[2].trim());
              break;
            }
          }
        } else {
          for (let i = nicheIndex; i < nextNicheIndex; i++) {
            const element = rows[i];
            if (element[1].toUpperCase().trim() == subNicheVal.toUpperCase()) {
              arrTags.push(element[2].trim());
              break;
            }
          }
        }
      });
    });
    setTimeout(() => {
      if (typeof arrTags[0] != "undefined") {
        tagListArr = arrTags[0].split(" ");
      } else {
        tagListArr = [];
      }
    }, 12000);
    // Read collection
    let collectionStr = "";
    const collectionPath =
      process.env.NODE_ENV === "development"
        ? "./data/collection.csv"
        : path.join(process.resourcesPath, "data/collection.csv");
    fs.readFile(collectionPath, "utf8", function (err, data) {
      if (err) {
        log.error(err);
        logger.error(err.stack, loggerObj);
      }
      collectionStr = data;
    });
    //Browser handlers
    const { browser, page } = await common.openBrowser(proxyIP);
    await homeWindow.webContents.send("logs", "Browser opened");
    if (proxyUser.trim() != "" && proxyPass.trim() != "") {
      await page.authenticate({
        username: proxyUser,
        password: proxyPass,
      });
    }
    await page.setDefaultNavigationTimeout(0);
    await page.goto(`https://displate.com/auth/signin`, {
      waitUntil: "networkidle2",
    });
    await myFunc.timeOutFunc(1000);
    await page.waitForSelector(".button--login");
    let siteCapt = await page.evaluate(() => {
      let grecaptcha = document.getElementById("g-recaptcha-response");
      let result = false;
      grecaptcha != null ? (result = true) : (result = false);
      return result;
    });
    if (siteCapt) {
      await page.type("[name='usernameOrEmail']", accUsername);
      await myFunc.timeOutFunc(1000);
      await page.type("[name='password']", accPassword);
      console.log("resolving siteCapt");
      await homeWindow.webContents.send("logs", "Resolving captcha...");
      await page.solveRecaptchas();
      await homeWindow.webContents.send("logs", "Resolved captcha");
      console.log("resolved siteCapt");
      await myFunc.timeOutFunc(1000);
      await Promise.all([page.click(".button--login"), page.waitForNavigation()]).catch((err) => {
        log.error(err);
        logger.error(err.stack, loggerObj);
      });
    } else {
      await page.type("[name='usernameOrEmail']", accUsername);
      await myFunc.timeOutFunc(1000);
      await page.type("[name='password']", accPassword);
      await myFunc.timeOutFunc(1000);
      await Promise.all([page.click(".button--login"), page.waitForNavigation()]).catch((err) => {
        log.error(err);
        logger.error(err.stack, loggerObj);
      });
    }
    try {
      await page.waitForSelector(".aside-menu__item--user", { timeout: 5000 });
      await homeWindow.webContents.send("logs", `Login success: ${accUsername}`);
    } catch (error) {
      await homeWindow.webContents.send("logs", `Login Error: ${accUsername}`);
      await common.closeBrowser(browser).catch((err) => {
        log.error(err);
        logger.error(err.stack, loggerObj);
      });
      await homeWindow.webContents.send("logs", "Browser closed");
      return;
    }
    // Go to File upload
    await page.goto("https://displate.com/file-upload");
    await myFunc.timeOutFunc(2000);
    await page.waitForSelector(".button--big");
    const [fileChooser] = await Promise.all([
      page.waitForFileChooser(),
      // page.click(".button--big"),
      page.evaluate(() => {
        //Input file chooser
        document.querySelector(".button--big").click();
      }),
    ]).catch((err) => {
      log.error(err);
      logger.error(err.stack, loggerObj);
    });
    // Upload 1st image
    const firstImg = [];
    firstImg.push(arrImgPath[0]);
    await fileChooser.accept(firstImg);
    await homeWindow.webContents.send("logs", `Uploading ${arrImgPath[0]} images...`);
    console.log(`Uploading ${arrImgPath[0]}...`);
    await myFunc.timeOutFunc(3000);
    siteCapt = await page.evaluate(() => {
      let grecaptcha = document.getElementById("g-recaptcha-response");
      let result = false;
      grecaptcha != null ? (result = true) : (result = false);
      return result;
    });
    // resolve captcha when upload 1st time
    if (siteCapt) {
      console.log("resolving siteCapt");
      await homeWindow.webContents.send("logs", "Resolving captcha...");
      await page.solveRecaptchas();
      await homeWindow.webContents.send("logs", "Resolved captcha");
      console.log("resolved siteCapt");
    }
    await myFunc.timeOutFunc(5000);
    await page.waitForSelector('[data-id="0"]');
    // Type title
    let imgPath = arrImgPath[0];
    let imgName = imgPath.replace(/^.*[\\\/]/, "");
    let imgDirname = path.dirname(imgPath);
    let imgNameInChars = arrImgPath[0]
      .match(regexStr)[0]
      .replace(/-/g, " ")
      .replace(/[^a-zA-Z ]/g, "")
      .trim();

    // type title
    await page.type("#title", imgNameInChars);
    let imgNameInCharsSplit = imgNameInChars.split(" ");
    let arrDescription = [];
    arrDescription = [...tagListArr];
    imgNameInCharsSplit.forEach((element) => {
      if (tagListArr != "") {
        arrDescription.splice(0, 0, element);
      } else {
        arrDescription.push(element);
      }
    });
    let desciptionStr = "";
    for (let k = 0; k < arrDescription.length; k++) {
      desciptionStr += `${arrDescription[k]} `;
    }
    await myFunc.timeOutFunc(2000);
    // Type description
    await page.type("#description", desciptionStr);
    // Upload the rest of images
    if (arrImgPath.length > 1) {
      for (let index = 1; index < arrImgPath.length; index++) {
        let imgPath = arrImgPath[index];
        let imgNameInChars = imgPath
          .match(regexStr)[0]
          .replace(/-/g, " ")
          .replace(/[^a-zA-Z ]/g, "")
          .trim();
        let arrDescriptions = [];
        arrDescriptions = [...tagListArr];
        imgNameInCharsSplit.forEach((element) => {
          if (tagListArr != "") {
            arrDescriptions.splice(0, 0, element);
          } else {
            arrDescriptions.push(element);
          }
        });
        let desciptionStr = "";
        for (let k = 0; k < arrDescriptions.length; k++) {
          desciptionStr += `${arrDescriptions[k]} `;
        }
        await myFunc.timeOutFunc(1500);
        const [fileChooser] = await Promise.all([
          page.waitForFileChooser(),
          page.click('label[for="fileInput"]'),
        ]).catch((err) => {
          log.error(err);
          logger.error(err.stack, loggerObj);
        });
        let imgForUpload = [];
        imgForUpload.push(arrImgPath[index]);
        await fileChooser.accept(imgForUpload);
        await myFunc.timeOutFunc(2000);
        await page.waitForSelector(`[data-id="${index}"]`);
        await page.evaluate((index) => {
          const product = document.querySelector(`[data-id="${index}"]`);
          if (product != null) {
            product.click();
          }
          return;
        }, index);
        await myFunc.timeOutFunc(1500);
        await page.type("#title", imgNameInChars);
        await myFunc.timeOutFunc(2000);
        await page.type("#description", desciptionStr);
        await myFunc.timeOutFunc(1000);
      }
    }
    await myFunc.timeOutFunc(1000);
    // click to images section
    await page.click("#previewList");
    // select all images
    await page.keyboard.down("Control");
    await page.keyboard.press("A");
    await page.keyboard.up("Control");
    await myFunc.timeOutFunc(1000);
    // select collection
    await page.waitForSelector(".select__control");
    await page.click(".select__control");
    await myFunc.timeOutFunc(1000);
    // select Collection
    console.log(collectionStr);
    const collectionID = await page.evaluate((collectionStr) => {
      let arrSelection = document.querySelectorAll(".select__option");
      let idSelect = "";
      if (arrSelection.length > 0) {
        arrSelection.forEach((v) => {
          if (v.textContent.toUpperCase() == collectionStr.toUpperCase()) {
            idSelect = v.id;
          }
        });
      }
      return idSelect;
    }, collectionStr);
    await myFunc.timeOutFunc(1000);
    console.log(`collectionID`);
    console.log(collectionID);
    await myFunc.timeOutFunc(500);
    if (collectionID != "") {
      await page.click("#" + collectionID);
    } else {
      // create new collection if it doesn't exist
      await page.click(".editor__group");
      await myFunc.timeOutFunc(1000);
      await page.evaluate(() => {
        const createBtn = document.querySelector(".collection__button>div");
        if (createBtn != null) {
          createBtn.nextElementSibling.click();
        }
      });
      await myFunc.timeOutFunc(1000);
      await page.waitForSelector("#new-collection");
      await page.type("#new-collection", collectionStr);
      await myFunc.timeOutFunc(1000);
      await page.evaluate(() => {
        document.querySelector(".button--secondary.button--small").click();
      });
    }
    await myFunc.timeOutFunc(2000);
    // select Type
    await page.evaluate((imgType) => {
      const arrImgType = document.querySelectorAll("span.input-radio__label");
      if (arrImgType != null) {
        for (let index = 0; index < arrImgType.length; index++) {
          const element = arrImgType[index];
          if (element.textContent == imgType) {
            element.click();
          }
        }
      }
    }, imgType);
    await myFunc.timeOutFunc(2000);
    // select category
    for (let index = 0; index < arrCategory.length; index++) {
      let category = arrCategory[index].trim();
      // await page.click(`.input-checkbox__checkbox[name="${element}"]`);
      await page.evaluate((category) => {
        document.querySelector(`.input-checkbox__checkbox[name="${category}"]`).click();
      }, category);
      await myFunc.timeOutFunc(1000);
    }

    // type Tags
    const tagInput = ".tags__input > input";
    await page.waitForSelector(tagInput);
    for (let index = 0; index < (tagListArr.length >= 20 ? 20 : tagListArr.length); index++) {
      const element = tagListArr[index];
      await page.type(tagInput, `${element} `);
      await myFunc.timeOutFunc(500);
    }
    await myFunc.timeOutFunc(2000);
    const uploadBtn = "#multi-submit";
    await page.waitForSelector(uploadBtn);
    const is_disabled = (await page.$(`${uploadBtn}[disabled]`)) !== null;
    if (!is_disabled) {
      await page.click(uploadBtn);
    }
    await myFunc.timeOutFunc(2000);
    await page.evaluate(() => {
      const arrTermOfUse = document.querySelectorAll(".input-checkbox__label");
      if (arrTermOfUse.length > 0) {
        arrTermOfUse.forEach((v) => {
          if (v.textContent.includes("Terms of Use")) {
            v.click();
          }
        });
      }
    });
    await myFunc.timeOutFunc(1000);
    console.log("resolving siteCapt");
    await homeWindow.webContents.send("logs", "Resolving captcha...");
    await page.solveRecaptchas();
    await homeWindow.webContents.send("logs", "Resolved captcha");
    console.log("resolved siteCapt");
    await myFunc.timeOutFunc(2000);
    await page.evaluate(() => {
      const btnUpload = document.querySelectorAll(".button.button--primary.button--center");
      if (btnUpload.length > 0) {
        if (btnUpload[1].disabled == false) {
          btnUpload[1].click();
        }
      }
    });
    await myFunc.timeOutFunc(3000);
    await page.waitForFunction(
      () => {
        let selector = document.querySelectorAll(".heading-1");
        var result = false;
        if (selector[1].textContent == "Hurray!Artwork uploaded!") {
          result = true;
        }
        return result;
      },
      { timeout: 0 }
    );
    await homeWindow.webContents.send("logs", "Product uploaded");
    let newPath = path.join(imgDirname, "./done");
    if (!fs.existsSync(newPath)) {
      fs.mkdirSync(newPath);
      await homeWindow.webContents.send("logs", `Folder done created`);
    }
    for (let index = 0; index < arrImgPath.length; index++) {
      const regexStr = /([^\\]+)(?=\.\w+$)/;
      let imgPath = arrImgPath[index];
      let imgName = imgPath.replace(/^.*[\\\/]/, "");
      fs.rename(imgPath, path.join(newPath, "./" + imgName), (err) => {
        if (err) {
          log.error(err);
          logger.error(err.stack, loggerObj);
        }
        homeWindow.webContents.send("logs", `Move ${imgName} to done folder`);
      });
    }
    fs.rename(imgPath, path.join(newPath, "./" + imgName), (err) => {
      if (err) {
        log.error(err);
        logger.error(err.stack, loggerObj);
      }
      homeWindow.webContents.send("logs", `Move ${imgName} to done folder`);
    });
    //Notification
    const notifier = new WindowsToaster({
      withFallback: false,
    });
    notifier.notify(
      {
        appName: "displate-upload-tool",
        title: "Displate Upload Tool",
        message: "Upload Completed!",
        sound: true,
      },
      function (err, response) {
        if (err) {
          log.error(err);
          logger.error(err.stack, loggerObj);
        }
        // Response is response from notification
      }
    );
    await common.closeBrowser(browser).catch((err) => {
      log.error(err);
      logger.error(err.stack, loggerObj);
    });
    await homeWindow.webContents.send("logs", "Browser closed");
  } catch (err) {
    log.error(err);
    logger.error(err.stack, loggerObj);
  }
}

//----------------------------------
// OPEN ACCOUNT PROCESS
//----------------------------------
async function openAccount(userInfo) {
  try {
    const accUsername = userInfo[0];
    const accPassword = userInfo[1];
    const proxyIP = userInfo[2];
    const proxyUser = userInfo[3];
    const proxyPass = userInfo[4];

    const { browser, page } = await common.openBrowser(proxyIP);
    await homeWindow.webContents.send("logs", "Browser opened");
    if (proxyUser.trim() != "" && proxyPass.trim() != "") {
      await page.authenticate({
        username: proxyUser,
        password: proxyPass,
      });
    }
    await page.setDefaultNavigationTimeout(0);
    await page.goto(`https://displate.com/auth/signin`, {
      waitUntil: "networkidle2",
    });
    await myFunc.timeOutFunc(1000);
    await page.waitForSelector(".button--login");
    let siteCapt = await page.evaluate(() => {
      let grecaptcha = document.getElementById("g-recaptcha-response");
      let result = false;
      grecaptcha != null ? (result = true) : (result = false);
      return result;
    });
    if (siteCapt) {
      await page.type("[name='usernameOrEmail']", accUsername);
      await myFunc.timeOutFunc(1000);
      await page.type("[name='password']", accPassword);
      console.log("resolving siteCapt");
      await homeWindow.webContents.send("logs", "Resolving captcha...");
      await page.solveRecaptchas();
      await homeWindow.webContents.send("logs", "Resolved captcha");
      console.log("resolved siteCapt");
      await myFunc.timeOutFunc(1000);
      await Promise.all([page.click(".button--login"), page.waitForNavigation()]).catch((err) => {
        log.error(err);
        logger.error(err.stack, loggerObj);
      });
    } else {
      await page.type("[name='usernameOrEmail']", accUsername);
      await myFunc.timeOutFunc(1000);
      await page.type("[name='password']", accPassword);
      await myFunc.timeOutFunc(1000);
      await Promise.all([page.click(".button--login"), page.waitForNavigation()]).catch((err) => {
        log.error(err);
        logger.error(err.stack, loggerObj);
      });
    }
    try {
      await page.waitForSelector(".aside-menu__item--user", { timeout: 5000 });
      await homeWindow.webContents.send("logs", `Login success: ${accUsername}`);
    } catch (error) {
      await homeWindow.webContents.send("logs", `Login Error: ${accUsername}`);
      await common.closeBrowser(browser).catch((err) => {
        log.error(err);
        logger.error(err.stack, loggerObj);
      });
      await homeWindow.webContents.send("logs", "Browser closed");
      return;
    }
  } catch (err) {
    log.error(err);
    logger.error(err.stack, loggerObj);
  }
}
