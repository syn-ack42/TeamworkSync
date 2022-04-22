const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const csv = require("csv-parser");
const fs = require("fs");
const crypto = require("crypto");
const parse = require('date-fns/parse')

var config = {
  base_url: "https://aspiresoftware.eu.teamwork.com",
  token: "fds",
  winame_col: "Work Item",
  start_col: "Start",
  end_col: "End",
  task_col: "TeamworkTask",
  notes_col: "Notes",
  date_pattern: "dd.MM.yyyy HH:mm:ss"
};

var mainWindow;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 1000,
    title: "Teamwork Sync",
    webPreferences: {
      nodeIntegration: false,
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
  var rnum = 1;
  const errors = []
  const table_data = raw.map((r) => {
    var t = {
      row: {value: rnum++, error: null},
      name: {value: r[config.winame_col], error: null},
      start: {value: r[config.start_col], error: null},
      end: {value: r[config.end_col], error: null},
      task: {value: r[config.task_col], error: null},
      note: {value: r[config.notes_col], error: null}
    };

    if (! t.name.value) {
      t.name.error = { severity: "WARNING", message: `Task name empty` }
    }

    const now = new Date();
    const s = parse(t.start.value, config.date_pattern, new Date("0000-01-01"))
    if (!s || s == "Invalid Date") {
      t.start.error = { severity: "ERROR", message: `Invalid or empty start time` }
    }
    else if (s.getTime() - now.getTime() > 30 * (1000 * 60 * 60 * 24)) {
      t.start.error = { severity: "ERROR", message: `Start time must not be more than 30 days in the future` }
    }
    else if (now.getTime() - s.getTime() > 365 * (1000 * 60 * 60 * 24)) {
      t.start.error = { severity: "ERROR", message: `Start time must not be more than 365 days in the past` }
    }

    const e = parse(t.end.value, config.date_pattern, new Date("0000-01-01"))
    if (!e || e == "Invalid Date") {
      t.end.error = { severity: "ERROR", message: `Invalid or empty end time` }
    }
    else if (e.getTime() - now.getTime() > 30 * (1000 * 60 * 60 * 24)) {
      t.end.error = { severity: "ERROR", message: `End time must not be more than 30 days in the future` }
    }
    else if (now.getTime() - e.getTime() > 365 * (1000 * 60 * 60 * 24)) {
      t.end.error = { severity: "ERROR", message: `End time must not be more than 365 days in the past` }
    }
    else if (e.getTime() - s.getTime() <= 0) {
      t.end.error = { severity: "ERROR", message: `End time must not be before start time.` }
    }


    if (! t.task.value) {
      t.task.error = { severity: "ERROR", message: `Teamwork task id may not be empty` }
    }
    else if (isNaN(t.task.value) || 
      parseInt(Number(t.task.value)) != t.task.value ||
      isNaN(parseInt(t.task.value, 10)) ||
      parseInt(t.task.value, 10) <0
      ) {
      t.task.error = { severity: "ERROR", message: `Teamwork task id may must be a positive integer` }
    }

    for (const x in t) {
      if (t[x].error) {
        errors.push({...t[x].error, column: x, row: t.row.value})
      }
    }
    return t
  });

  return {table_data: table_data, errors: errors};
}


function check_mandatory_cols(raw) {
  const errs = [];
  if (raw.length <= 0) {
    errs.table = { severity: "ERROR", message: `File empty or not a csv file` };
    return errs;
  }

  if (raw[0][config.start_col] == undefined) {
    errs.push({
      severity: "ERROR",
      column: "start",
      row: null,
      message: `Start time column '${config.start_col}' missing`,
    })
  }
  if (raw[0][config.end_col] == undefined) {
    errs.push({
      severity: "ERROR",
      column: "end",
      row: null,
      message: `End time column '${config.end_col}' missing`,
    })
  }
  if (raw[0][config.task_col] == undefined) {
    errs.push({
      severity: "ERROR",
      column: "task",
      row: null,
      message: `Teamwork task id column '${config.task_col}' missing`,
    })
  }
  if (raw[0][config.notes_col] == undefined) {
    errs.push({
      severity: "WARNING",
      column: "note",
      row: null,
      message: `Notes column '${config.notes_col}' missing`,
    })
  }
  if (raw[0][config.winame_col] == undefined) {
    errs.push({
      severity: "WARNING",
      column: "name",
      row: null,
      message: `Work item name column '${config.winame_col}' missing`,
    })
  }
  return errs
}

function open_csv(filePath) {
  var tbl_data = [];
  fs.createReadStream(filePath)
    .pipe(csv())
    .on("data", (row) => {
      tbl_data.push(row);
    })
    .on("end", () => {
      process_csv_data(tbl_data);
    })
    .on("error", (err) => {
      const e = [
        { severity: "ERROR", column: null, row: null, message: `Failure to read file '${err.message}'` },
      ];
      mainWindow.webContents.send("set-table-data", {tbl_data: null, tbl_errors: e});
      console.log(err);
    });
}

function process_csv_data(raw) {
  const errs = check_mandatory_cols(raw);
  const {table_data, errors} = structure_raw_data(raw);

  mainWindow.webContents.send("set-table-data", {tbl_data: table_data, tbl_errors: errs.concat(errors)});
}
