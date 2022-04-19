const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const csv = require("csv-parser");
const fs = require("fs");
const crypto = require("crypto");

var config = {
  base_url: "https://aspiresoftware.eu.teamwork.com",
  token: "fds",
  winame_col: "Work Item",
  start_col: "Start",
  end_col: "End",
  task_col: "TeamworkTask",
  notes_col: "Notes",
};

var mainWindow;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 1000,
    title: "Teamwork Sync",
    webPreferences: {
      nodeIntegration: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.loadFile("index.html");
  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.whenReady().then(() => {
  ipcMain.handle("open-file-dialog", file_open_dialog);
  ipcMain.handle("open-file-drop", (event, filename) => {
    open_csv(filename);
  });
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

async function file_open_dialog() {
  const { canceled, filePaths } = await dialog.showOpenDialog();
  if (canceled) {
    return;
  } else {
    open_csv(filePaths[0]);
    return filePaths[0];
  }
}

function structure_raw_data(raw) {
  var rnum = 0;
  return raw.map((r) => {
    var t = {
      row: rnum++,
      name: r[config.winame_col],
      start: r[config.start_col],
      end: r[config.end_col],
      task: r[config.task_col],
      note: r[config.notes_col],
    };
    return t;
  });
}

function check_mandatory_cols(raw) {
  const errs = [];
  if (raw.length <= 0) {
    errs.push({ severity: "ERROR", message: `File empty or not a csv file` });
    return errs;
  }

  if (raw[0][config.start_col] == undefined) {
    errs.push({
      severity: "ERROR",
      message: `Start time column '${config.start_col}' missing`,
    });
  }
  if (raw[0][config.end_col] == undefined) {
    errs.push({
      severity: "ERROR",
      message: `End time column '${config.end_col}' missing`,
    });
  }
  if (raw[0][config.task_col] == undefined) {
    errs.push({
      severity: "ERROR",
      message: `Teamwork task id column '${config.task_col}' missing`,
    });
  }
  if (raw[0][config.notes_col] == undefined) {
    errs.push({
      severity: "WARNING",
      message: `Notes column '${config.notes_col}' missing`,
    });
  }
  return errs;
}

function open_csv(filePath) {
  var tbl_data = [];
  fs.createReadStream(filePath)
    .pipe(csv())
    .on("data", (row) => {
      console.log(row);
      tbl_data.push(row);
    })
    .on("end", () => {
      process_csv_data(tbl_data);
    })
    .on("error", (err) => {
      const e = [
        { severity: "ERROR", message: `Failure to read file '${err.message}'` },
      ];
      mainWindow.webContents.send("set-error-data", e);
      console.log(err);
    });
}

function process_csv_data(raw) {
  var errs = check_mandatory_cols(raw);
  var d = structure_raw_data(raw);
  mainWindow.webContents.send("set-table-data", d);
  mainWindow.webContents.send("set-error-data", errs);
}
