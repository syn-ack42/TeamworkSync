const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const csv = require("csv-parser");
const fs = require("fs");
const parse = require("date-fns/parse");
const format = require("date-fns/format")
const axios = require("axios");

const default_config = {
  base_url: "https://aspiresoftware.eu.teamwork.com",
  token: "fds",
  winame_col: "Work Item",
  start_col: "Start",
  end_col: "End",
  task_col: "TeamworkTask",
  notes_col: "Notes",
  date_pattern: "dd.MM.yyyy HH:mm:ss",
};

var g_data = [];
var g_errors = []

var mainWindow;

const userDataFile = path.join(app.getPath("userData"), "config.json");
var config = parseConfFile(userDataFile, default_config);

function parseConfFile(filePath, defaults) {
  try {
    return JSON.parse(fs.readFileSync(filePath));
  } catch (error) {
    return defaults;
  }
}

function storeConfigFile(filename, conf) {
  const c = Object.assign(default_config, conf);
  fs.writeFileSync(filename, JSON.stringify(c));
}

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
  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.webContents.send("set-config", config);
  });

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.whenReady().then(() => {
  ipcMain.handle("open-file-dialog", open_file_dialog);
  ipcMain.handle("submit-to-teamwork", submit_to_teamwork);
  ipcMain.handle("open-file-drop", (event, filename) => {
    open_csv(filename);
  });
  ipcMain.handle("store-config", (event, conf) => {
    storeConfigFile(userDataFile, conf);
    config = parseConfFile(userDataFile, config);
    mainWindow.webContents.send("set-config", config);
  });
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

async function open_file_dialog() {
  const { canceled, filePaths } = await dialog.showOpenDialog();
  if (canceled) {
    return;
  } else {
    open_csv(filePaths[0]);
    return filePaths[0];
  }
}

function structure_raw_data(raw, tasks) {
  var rnum = 1;
  const errors = [];
  const table_data = raw.map((r) => {
    var t = {
      row: { value: rnum++, error: null },
      name: { value: r[config.winame_col], error: null },
      start: { value: r[config.start_col], error: null },
      end: { value: r[config.end_col], error: null },
      task: { value: r[config.task_col], error: null },
      note: { value: r[config.notes_col], error: null },
      teamwork_customer: { value: "", error: null },
      teamwork_project: { value: "", error: null },
      teamwork_content: { value: "", error: null },
    };

    if (!t.name.value) {
      t.name.error = { severity: "WARNING", message: `Task name empty` };
    }

    const now = new Date();
    const s = parse(t.start.value, config.date_pattern, new Date("0000-01-01"));
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

    const e = parse(t.end.value, config.date_pattern, new Date("0000-01-01"));
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

  return [ table_data, errors ];
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
    });
  }
  if (raw[0][config.end_col] == undefined) {
    errs.push({
      severity: "ERROR",
      column: "end",
      row: null,
      message: `End time column '${config.end_col}' missing`,
    });
  }
  if (raw[0][config.task_col] == undefined) {
    errs.push({
      severity: "ERROR",
      column: "task",
      row: null,
      message: `Teamwork task id column '${config.task_col}' missing`,
    });
  }
  if (raw[0][config.notes_col] == undefined) {
    errs.push({
      severity: "WARNING",
      column: "note",
      row: null,
      message: `Notes column '${config.notes_col}' missing`,
    });
  }
  if (raw[0][config.winame_col] == undefined) {
    errs.push({
      severity: "WARNING",
      column: "name",
      row: null,
      message: `Work item name column '${config.winame_col}' missing`,
    });
  }
  return errs;
}

function open_csv(filePath) {
  var tbl_data = [];
  fs.createReadStream(filePath)
    .pipe(csv())
    .on("data", (row) => {
      var r = {};
      Object.keys(row).map((k) => {
        r[k.trim()] = row[k]
      })
      tbl_data.push(r);
    })
    .on("end", () => {
      process_csv_data(tbl_data);
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
      mainWindow.webContents.send("set-table-data", {
        tbl_data: null,
        tbl_errors: null,
      });
      mainWindow.webContents.send("set-errors", e);
      console.log(err);
    });
}

async function process_csv_data(raw) {
  var gen_errors = [];
  var valid_tasks = [];
  try {
    valid_tasks = await get_task_list();
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
  }
  var tasks = {};
  valid_tasks.forEach((task) => (tasks[task.id] = task));

  const col_errs = check_mandatory_cols(raw);
  const [ table_data, d_errs ] = structure_raw_data(raw, tasks);
  const tbl_errors = col_errs.concat(d_errs);

  g_data = table_data
  g_errors = gen_errors.concat(tbl_errors);

  mainWindow.webContents.send("set-table-data", {
    tbl_data: g_data,
    tbl_errors: tbl_errors,
  });
  mainWindow.webContents.send("set-errors", g_errors);
}

async function get_task_list() {
  const resp = await axios.get(`${config.base_url}/tasks.json`, {
    params: {},
    headers: {
      "Content-Type": "application/json",
    },
    auth: {
      username: config.token,
      password: "X",
    },
  });
  return resp.data["todo-items"].filter((x) => {
    return x["canLogTime"] == true;
  });
}

async function submit_to_teamwork() {
  if (g_errors.filter((x) => {return x.severity == "ERROR"}).length >0) {
    const e = [
      {
        severity: "ERROR",
        column: null,
        row: null,
        message: `Can't send to Teamwork while there are 'ERROR' entries!`,
      },
    ];
    mainWindow.webContents.send("set-errors", e.concat(g_errors))
    return
  }

  for (row of g_data) {
    if (!await submit_time_record(row)) {
      g_errors.push({
        severity: "ERROR",
        column: null,
        row: null,
        message: `Stopping submission to Teamwork at ${row.row.value}. Failure: '${err.message}'`,
      });
      mainWindow.webContents.send("set-errors", g_errors)
      return
    }
  }
  g_errors = []
  g_data = []
  mainWindow.webContents.send("set-errors", g_errors)
  mainWindow.webContents.send("set-table-data", {
    tbl_data: g_data,
    tbl_errors: g_errors,
  });
}

async function submit_time_record(rec) {

  const now = new Date();
  const s = parse(rec.start.value, config.date_pattern, new Date("0000-01-01"));
  const e = parse(rec.end.value, config.date_pattern, new Date("0000-01-01"));

  const d = e.getTime() - s.getTime()
  const hrs = parseInt(d / 3600000)
  const mts = parseInt((d%3600000) / 60000)

  const data = {
    "time-entry": {
      "description": row.note.value,
      "date": format(s, 'yyyyMMdd'),
      "time": format(s, 'HH:mm'),
      "hours": hrs,
      "minutes": mts
    }
  }

  try {
    const resp = await axios.post(`${config.base_url}/tasks/${row.task.value}/time_entries.json`, 
      data, {
      params: {},
      headers: {
        "Content-Type": "application/json",
      },
      auth: {
        username: config.token,
        password: "X",
      }
    });    
  
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
  mainWindow.webContents.send("set-errors", g_errors)
  return false;
}
return true;


}