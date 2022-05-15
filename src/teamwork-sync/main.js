const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const csv = require("csv-parser");
const fs = require("fs");
const parse = require("date-fns/parse");
const format = require("date-fns/format");
const axios = require("axios");

const nodeCrypto = require("crypto");
const algorithm = "aes-256-cbc";

const default_config = {
  base_url: "https://YOUR_COMPANY.XX.teamwork.com",
  token: "YOUR_TOKEN",
  pwd_hash: null,
  pwd_iv: null,
  winame_col: "Work Item",
  start_col: "Start",
  end_col: "End",
  task_col: "TeamworkTask",
  notes_col: "Notes",
  date_pattern: "dd.MM.yyyy HH:mm:ss",
};

/*----------------------------------------------------------------
        APPLICATTION STATE
----------------------------------------------------------------*/
var g_appState = "UNINIT"; //UNINIT, LOCKED, UNLOCKED
var g_data = [];
var g_errors = [];

var g_mainWindow = null;

var g_config = null; //the decrypted version of the config
var g_crypt_key = null; //the encryption key derived from the user password
/*--------------------------------------------------------------*/

/*----------------------------------------------------------------
        INITIALIZE APPLICATTION
----------------------------------------------------------------*/
const userDataFile = path.join(app.getPath("userData"), "config.json");

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.whenReady().then(() => {
  ipcMain.handle("reset-password", (event) => {
    return handleResetPassword();
  });
  ipcMain.handle("pwd-entered", (event, pwd) => {
    return handlePasswordEntry(pwd);
  });
  ipcMain.handle("app-reset", handleAppReset);

  ipcMain.handle("open-file-dialog", openFileViaDialog);
  ipcMain.handle("submit-to-teamwork", submitToTeamwork);
  ipcMain.handle("open-file-drop", (event, filename) => {
    processTimeRecordsFile(filename);
  });
  ipcMain.handle("store-config", (event, conf) => {
    g_config = Object.assign(g_config, conf);
    storeConfigFile();
    g_mainWindow.webContents.send("set-config", g_config);
  });
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  if (loadConfFile()) {
    g_appState = "LOCKED";
  }

  g_mainWindow.webContents.on("did-finish-load", () => {
    g_mainWindow.webContents.send("set-app-state", g_appState);
  });
});

/*--------------------------------------------------------------*/

/**
 * Handles password entry events from the frontend depending on application state.
 * If the application is in LOCKED state, the password is verified and the result of
 * the check is returned.
 * If the application is not in UNINIT (uniitialized) state, the password is set as
 * the new application password..
 * @param {string} pwd The password entered by the user
 * @returns {any} true if the password was verfied / successfully set.
 */
function handlePasswordEntry(pwd) {
  if (g_appState === "LOCKED") {
    return handlePasswordCheck(pwd);
  } else if (g_appState === "UNINIT") {
    return setPassword(pwd);
  }
}

/**
 * Set the password to the new value.
 * Reinitilizes all the cryptography and re-saves the configuration with the confidential
 * parts encrypted using the new password.
 * The application state is the set to UNLOCKED.
 * @param {string} pwd The new password
 * @returns {any} true on sucvessful setting of the new password
 */
function setPassword(pwd) {
  var hash = nodeCrypto.createHash("sha256");
  hash.update(pwd);
  g_config.pwd_hash = hash.digest();

  hash = nodeCrypto.createHash("sha256");
  hash.update(pwd);
  hash.update("encryptokey");
  g_crypt_key = hash.digest();

  g_config.pwd_iv = nodeCrypto.randomBytes(16);
  storeConfigFile();
  g_appState = "UNLOCKED";
  g_mainWindow.webContents.send("set-app-state", g_appState);
  g_mainWindow.webContents.send("set-config", g_config);

  return true;
}

/**
 * UI action handler for a password reset requests.
 * Unsets all the cryptography and sets the application state to "UNINIT"
 * Does discard the sensitive data or not overwrite the config file.
 * @returns {boolean} always returns true on success
 */
function handleResetPassword() {
  g_config.pwd_hash = null;
  g_config.pwd_iv = null;
  g_crypt_key = null;
  g_appState = "UNINIT";
  g_mainWindow.webContents.send("set-app-state", g_appState);
  return true;
}

/**
 * Check the entered password against the configuration protected by a password.
 * If the password is correct the sensitive information in the config is decrypted
 * using the password.
 * On success the application state is set to "UNLOCKED", otherwise it is set to "LOCKED"
 * @param {string} pwd The password entered by the user
 * @returns {boolean} True if the password is correct, false otherwise
 */
function handlePasswordCheck(pwd) {
  var hash = nodeCrypto.createHash("sha256");
  hash.update(pwd);
  let d = hash.digest();

  if (g_config.pwd_hash.toString("base64") !== d.toString("base64")) {
    g_appState = "LOCKED";
    g_mainWindow.webContents.send("set-app-state", g_appState);
    return false;
  }

  try {
    var hash = nodeCrypto.createHash("sha256");
    hash.update(pwd);
    hash.update("encryptokey");

    g_crypt_key = hash.digest();

    const decipher = nodeCrypto.createDecipheriv(
      algorithm,
      g_crypt_key,
      g_config.pwd_iv
    );
    g_config.token = Buffer.concat([
      decipher.update(g_config.token, "base64"),
      decipher.final(),
    ]).toString();
    g_appState = "UNLOCKED";
    g_mainWindow.webContents.send("set-app-state", g_appState);
    g_mainWindow.webContents.send("set-config", g_config);
    return true;
  } catch (e) {
    g_appState = "LOCKED";
    g_mainWindow.webContents.send("set-app-state", g_appState);
    return false;
  }
}

/**
 * Reset the confidential configuration of the application.
 * Deletes the api token and the cryptographic data (password-hash, key) from
 * memory and overwrites the configuration file. Only the non-sensitive settings
 * are maintained in memory and in the file.
 */
function handleAppReset() {
  g_config.token = "YOUR_TOKEN";
  handleResetPassword();
  storeConfigFile();
}

/**
 * Loads the application configuration file from disk.
 * If the configuration file exists and is compelte the application will go to "LOCKED" state.
 * IF the file does not exist or if it does not contain the cryptographic
 * password attributes the application will be "UNINIT" (uniitialized)
 * @returns {null}
 */
function loadConfFile() {
  try {
    let c = JSON.parse(fs.readFileSync(userDataFile));
    if (c.token && c.pwd_hash && c.pwd_iv) {
      c.pwd_iv = Buffer.from(c.pwd_iv, "base64");
      c.pwd_hash = Buffer.from(c.pwd_hash, "base64");
      c.token = Buffer.from(c.token, "base64");
      g_appState = "LOCKED";
    } else {
      c.token = "YOUR_TOKEN";
      c.pwd_hash = null;
      c.pwd_iv = null;
      g_appState = "UNINIT";
    }
    g_config = c;
    return true;
  } catch (error) {
    g_appState = "UNINIT";
    g_config = Object.assign({}, default_config);
  }
}

/**
 * Save the configuration to disk.
 * The sensitive parameters in the configuration will be encrypted using a key
 * derived from the users password.
 * @returns {any}
 */
function storeConfigFile() {
  let tcnf = Object.assign({}, g_config);

  if (g_config.token && g_config.pwd_hash && g_config.pwd_iv) {
    const cipher = nodeCrypto.createCipheriv(
      algorithm,
      g_crypt_key,
      g_config.pwd_iv
    );
    tcnf.token = Buffer.concat([
      cipher.update(g_config.token || ""),
      cipher.final(),
    ]).toString("base64");
    tcnf.pwd_hash = Buffer(g_config.pwd_hash).toString("base64");
    tcnf.pwd_iv = Buffer(g_config.pwd_iv).toString("base64");
  } else {
    tcnf.token = "YOUR_TOKEN";
    tcnf.pwd_hash = null;
    tcnf.pwd_iv = null;
  }

  fs.writeFileSync(userDataFile, JSON.stringify(tcnf));
}

/**
 * Open the OS file picker dialog to select a csv file for processing.
 *
 * @returns {any} Null if the dialog is cancelled, the full file path if a file is selected and processed.
 */
async function openFileViaDialog() {
  const { canceled, filePaths } = await dialog.showOpenDialog();
  if (canceled) {
    return;
  } else {
    processTimeRecordsFile(filePaths[0]);
    return filePaths[0];
  }
}

/**
 * Takes the raw data from the csv file and structures it into an array of objects.
 * Everery record is validated and errors or warnings are logged.
 * @param {any} raw The raw csv data
 * @param {any} tasks A dictionary of Teamwork tasks.
 * @returns {array} The first item in the return array is the processed data, the second is an array of errors encountered.
 */
function processRawData(raw, tasks) {
  var rnum = 1;
  const errors = [];
  const tableData = raw.map((r) => {
    var t = {
      row: { value: rnum++, error: null },
      name: { value: r[g_config.winame_col], error: null },
      start: { value: r[g_config.start_col], error: null },
      end: { value: r[g_config.end_col], error: null },
      task: { value: r[g_config.task_col], error: null },
      note: { value: r[g_config.notes_col], error: null },
      teamwork_customer: { value: "", error: null },
      teamwork_project: { value: "", error: null },
      teamwork_content: { value: "", error: null },
    };

    if (!t.name.value) {
      t.name.error = { severity: "WARNING", message: `Task name empty` };
    }

    const now = new Date();
    const s = parse(
      t.start.value,
      g_config.date_pattern,
      new Date("0000-01-01")
    );
    if (!s || s == "Invalid Date") {
      t.start.error = {
        severity: "ERROR",
        message: `Invalid or empty start time`,
      };
    } else if (s.getTime() - now.getTime() > 30 * (1000 * 60 * 60 * 24)) {
      t.start.error = {
        severity: "ERROR",
        message: `Start time must not be more than 30 days in the future`,
      };
    } else if (now.getTime() - s.getTime() > 365 * (1000 * 60 * 60 * 24)) {
      t.start.error = {
        severity: "ERROR",
        message: `Start time must not be more than 365 days in the past`,
      };
    }

    const e = parse(t.end.value, g_config.date_pattern, new Date("0000-01-01"));
    if (!e || e == "Invalid Date") {
      t.end.error = { severity: "ERROR", message: `Invalid or empty end time` };
    } else if (e.getTime() - now.getTime() > 30 * (1000 * 60 * 60 * 24)) {
      t.end.error = {
        severity: "ERROR",
        message: `End time must not be more than 30 days in the future`,
      };
    } else if (now.getTime() - e.getTime() > 365 * (1000 * 60 * 60 * 24)) {
      t.end.error = {
        severity: "ERROR",
        message: `End time must not be more than 365 days in the past`,
      };
    } else if (e.getTime() - s.getTime() <= 0) {
      t.end.error = {
        severity: "ERROR",
        message: `End time must not be before start time.`,
      };
    }

    if (!t.task.value) {
      t.task.error = {
        severity: "ERROR",
        message: `Teamwork task id may not be empty`,
      };
    } else if (
      isNaN(t.task.value) ||
      parseInt(Number(t.task.value)) != t.task.value ||
      isNaN(parseInt(t.task.value, 10)) ||
      parseInt(t.task.value, 10) < 0
    ) {
      t.task.error = {
        severity: "ERROR",
        message: `Teamwork task id may must be a positive integer`,
      };
    } else if (!tasks[t.task.value]) {
      t.task.error = {
        severity: "ERROR",
        message: `Teamwork task with id ${t.task.value} not known`,
      };
    } else {
      t.teamwork_customer.value = tasks[t.task.value]["company-name"];
      t.teamwork_project.value = tasks[t.task.value]["project-name"];
      t.teamwork_content.value = tasks[t.task.value]["content"];
    }

    for (const x in t) {
      if (t[x].error) {
        errors.push({ ...t[x].error, column: x, row: t.row.value });
      }
    }
    return t;
  });

  return [tableData, errors];
}

/**
 * Check the raw csv data if it contains all mandatory columns.
 * @param {any} raw The raw csv data
 * @returns {array} An array of errors. Empty array if everything is OK.
 */
function checkMandatoryColumns(raw) {
  const errs = [];
  if (raw.length <= 0) {
    errs.table = { severity: "ERROR", message: `File empty or not a csv file` };
    return errs;
  }

  if (raw[0][g_config.start_col] == undefined) {
    errs.push({
      severity: "ERROR",
      column: "start",
      row: null,
      message: `Start time column '${g_config.start_col}' missing`,
    });
  }
  if (raw[0][g_config.end_col] == undefined) {
    errs.push({
      severity: "ERROR",
      column: "end",
      row: null,
      message: `End time column '${g_config.end_col}' missing`,
    });
  }
  if (raw[0][g_config.task_col] == undefined) {
    errs.push({
      severity: "ERROR",
      column: "task",
      row: null,
      message: `Teamwork task id column '${g_config.task_col}' missing`,
    });
  }
  if (raw[0][g_config.notes_col] == undefined) {
    errs.push({
      severity: "WARNING",
      column: "note",
      row: null,
      message: `Notes column '${g_config.notes_col}' missing`,
    });
  }
  if (raw[0][g_config.winame_col] == undefined) {
    errs.push({
      severity: "WARNING",
      column: "name",
      row: null,
      message: `Work item name column '${g_config.winame_col}' missing`,
    });
  }
  return errs;
}

/**
 * Open and process a csv file with time records.
 * The table data and any errors found are pushed to the frontend.
 * @param {any} filePath Path to the csv file.
 * @returns {any}
 */
function processTimeRecordsFile(filePath) {
  var tbl_data = [];
  fs.createReadStream(filePath)
    .pipe(csv())
    .on("data", (row) => {
      var r = {};
      Object.keys(row).map((k) => {
        r[k.trim()] = row[k];
      });
      tbl_data.push(r);
    })
    .on("end", () => {
      processTimeRecordsData(tbl_data);
    })
    .on("error", (err) => {
      const e = [
        {
          severity: "ERROR",
          column: null,
          row: null,
          message: `Failure to read file '${err.message}'`,
        },
      ];
      g_mainWindow.webContents.send("set-table-data", {
        tbl_data: null,
        tbl_errors: null,
      });
      g_mainWindow.webContents.send("set-errors", e);
      console.log(err);
    });
}

/**
 * Take a set of raw recors from a csv file, validate them, parse them into
 * the time record structure and send the data and any errors encountered to the frontend.
 * The processed data is also store in the global apllication state as are any errors encountered.
 * @param {any} raw The raw csv data
 * @returns {any}
 */
async function processTimeRecordsData(raw) {
  var gen_errors = [];
  var valid_tasks = [];
  valid_tasks = await getTaskList();

  var tasks = {};
  valid_tasks.forEach((task) => (tasks[task.id] = task));

  const col_errs = checkMandatoryColumns(raw);
  const [table_data, d_errs] = processRawData(raw, tasks);
  const tbl_errors = col_errs.concat(d_errs);

  g_data = table_data;
  g_errors = g_errors.concat(tbl_errors);

  g_mainWindow.webContents.send("set-table-data", g_data);
  g_mainWindow.webContents.send("set-errors", g_errors);
}

/**
 * Retreive a list of tasks assigned to the user from Teamwork.
 * Returns the list of tasks.
 * Errors are logged to the global application state error list.
 * @returns {any}
 */
async function getTaskList() {
  var gen_errors = [];
  try {
    const resp = await axios.get(`${g_config.base_url}/tasks.json`, {
      params: {},
      headers: {
        "Content-Type": "application/json",
      },
      auth: {
        username: g_config.token,
        password: "X",
      },
    });
    return resp.data["todo-items"].filter((x) => {
      return x["canLogTime"] == true;
    });
  } catch (err) {
    if (err.response && err.response.status === 401) {
      gen_errors.push({
        severity: "ERROR",
        column: null,
        row: null,
        message: `${err.response.status} - ${err.response.statusText}: Unauthorized please check Temawork token '${err.message}'`,
      });
    } else if (err.response) {
      gen_errors.push({
        severity: "ERROR",
        column: null,
        row: null,
        message: `${err.response.status} - ${err.response.statusText}: Failed get task list from Teamwork '${err.message}'`,
      });
    } else {
      gen_errors.push({
        severity: "ERROR",
        column: null,
        row: null,
        message: `Failed to connect to Teamwork '${err.message}'`,
      });
    }
    g_errors = g_errors.concat(gen_errors)
    return [];
  }
}

/**
 * Submits all time records in the global application state to Temawork.
 * If a record is successfully submitted it is removed from the global state.
 * Errors encountered are logged to the global state error list.
 * If all records are successfully submitted the global data and error lists are cleared.
 * @returns {any}
 */
async function submitToTeamwork() {
  if (
    g_errors.filter((x) => {
      return x.severity == "ERROR";
    }).length > 0
  ) {
    const e = [
      {
        severity: "ERROR",
        column: null,
        row: null,
        message: `Can't send to Teamwork while there are 'ERROR' entries!`,
      },
    ];
    g_mainWindow.webContents.send("set-errors", e.concat(g_errors));
    return;
  }

  const grs = g_data;

  while (g_data.length > 0) {
    const row = g_data.pop();
    if (!(await submitTimeRecord(row))) {
      g_errors.push({
        severity: "ERROR",
        column: null,
        row: null,
        message: `Stopping submission to Teamwork at ${row.row.value}. Failure: '${err.message}'`,
      });
      g_data.push(row);
      g_mainWindow.webContents.send("set-errors", g_errors);
      return;
    }
    g_mainWindow.webContents.send("set-table-data", g_data);
  }

  g_errors = [];
  g_data = [];
  g_mainWindow.webContents.send("set-errors", g_errors);
  g_mainWindow.webContents.send("set-table-data", g_data);
}

/**
 * Submit a single time record to Teamwork.
 * Errors are logged to the global error list.
 * @param {any} rec The time record to submit
 * @returns {any} true if successful, false on any failure
 */
async function submitTimeRecord(rec) {
  const now = new Date();
  const s = parse(
    rec.start.value,
    g_config.date_pattern,
    new Date("0000-01-01")
  );
  const e = parse(rec.end.value, g_config.date_pattern, new Date("0000-01-01"));

  const d = e.getTime() - s.getTime();
  const hrs = parseInt(d / 3600000);
  const mts = parseInt((d % 3600000) / 60000);

  const data = {
    "time-entry": {
      description: rec.note.value,
      date: format(s, "yyyyMMdd"),
      time: format(s, "HH:mm"),
      hours: hrs,
      minutes: mts,
    },
  };

  try {
    const resp = await axios.post(
      `${g_config.base_url}/tasks/${rec.task.value}/time_entries.json`,
      data,
      {
        params: {},
        headers: {
          "Content-Type": "application/json",
        },
        auth: {
          username: g_config.token,
          password: "X",
        },
      }
    );
  } catch (err) {
    if (err.response && err.response.status === 401) {
      g_errors.push({
        severity: "ERROR",
        column: null,
        row: null,
        message: `${err.response.status} - ${err.response.statusText}: Unauthorized please check Temawork token '${err.message}'`,
      });
    } else if (err.response) {
      g_errors.push({
        severity: "ERROR",
        column: null,
        row: null,
        message: `${err.response.status} - ${err.response.statusText}: Failed posting time record to Teamwork '${err.message}'`,
      });
    } else {
      g_errors.push({
        severity: "ERROR",
        column: null,
        row: null,
        message: `Failed to connect to Teamwork '${err.message}'`,
      });
    }
    g_mainWindow.webContents.send("set-errors", g_errors);
    return false;
  }
  return true;
}

/**
 * Create the main window and intialize it's basic data structures (configuration).
 *
 * @returns {any}
 */
const createWindow = () => {
  g_mainWindow = new BrowserWindow({
    width: 1500,
    height: 1000,
    title: "Teamwork Sync",
    webPreferences: {
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  g_mainWindow.loadFile("index.html");
  g_mainWindow.webContents.on("did-finish-load", () => {
    g_mainWindow.webContents.send("set-config", g_config);
  });

  // Open the DevTools.
  g_mainWindow.webContents.openDevTools();
};
