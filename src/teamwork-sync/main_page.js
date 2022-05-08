class TeamworkSync extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      appState: "UNINIT",
      pwdError: false,
      table: { tbl_data: [], tbl_errors: [] },
      errors: [],
      file_path: null,
      config: {
        base_url: "YOUR_URL",
        token: "YOUR_TOKEN",
        winame_col: "Work Item",
        start_col: "Start",
        end_col: "End",
        task_col: "TeamworkTask",
        notes_col: "Notes",
        date_pattern: "dd.MM.yyyy HH:mm:ss",
      },
      pw_dialog_open: true,
    };
  }

  setAppState(state) {
    var s = this.state;
    s.appState = state;
    this.setState(s);
  }

  async handlePassword(pw) {
    const r = await window.electronAPI.passwordEntered(pw);
    var s = this.state;
    s.pwdError = !r;
    this.setState(s);
  }

  async handlePasswordReset() {
    const r = await window.electronAPI.resetPassword();
    var s = this.state;
    s.pwdError = !r;
    this.setState(s);
  }

  handleConfigSave() {
    window.electronAPI.storeConfig(this.state.config);
  }

  handleSubmitToTeamwork() {
    window.electronAPI.submitToTeamwork();
  }

/**
 * UI action handler for application reset. 
 */ 
 async handleAppReset() {
    await window.electronAPI.appReset();
    var s = this.state;
    s.pwdError = false;
    this.setState(s);
  }

  updateConfKey(key, value) {
    var s = this.state;
    s.config[key] = value;
    this.setState(s);
  }

  updateConfig(conf) {
    var s = this.state;
    s.config = conf;
    this.setState(s);
  }

  setTable(data) {
    var s = this.state;
    s.table = data || { tbl_data: [], tbl_errors: [] };
    this.setState(s);
  }

  setErrors(data) {
    var s = this.state;
    s.errors = data || [];
    this.setState(s);
  }

  async loadCSV() {
    const filePath = await window.electronAPI.openFileDialog();
    var s = this.state;
    s.file_path = filePath || null;
    this.setState(s);
  }

  render() {
    return (
      <div>
        <div className="app-section">
          <h1>1. Load</h1>
          <p className="text">
            Open a CSV file with time records or just drag&nbsp;drop it on this
            app.
          </p>
          <button
            type="button"
            onClick={() => {
              this.loadCSV();
            }}
          >
            Open CSV
          </button>
          <div className="filename">
            Selected file: {this.state.file_path || ""}
          </div>
        </div>
        <div className="app-section">
          <h1>2. Check</h1>
          <p className="text">
            Review your data - you will only be able to post it if there are no
            ERRORs.
          </p>
          <DataTable table={this.state.table} />
          <ErrorList errors={this.state.errors} />
        </div>
        <div className="app-section">
          <h1>3. Submit</h1>
          <p className="text">
            Everthing looks good? Submit your time records to Teamworks.
          </p>
          <button
            type="button"
            disabled={
              this.state.errors.filter((x) => {
                return x.severity == "ERROR";
              }).length > 0 || this.state.table.tbl_data.length <= 0
            }
            onClick={() => {
              this.handleSubmitToTeamwork();
            }}
          >
            Submit to Teamwork
          </button>
        </div>
        <ConfigMenu
          config={this.state.config}
          onConfKeyUpdate={(key, value) => this.updateConfKey(key, value)}
          onConfSave={(conf) => this.handleConfigSave(conf)}
          onPwdReset={() => this.handlePasswordReset()}
        />
        <PasswordDialog
          appState={this.state.appState}
          pwdError={this.state.pwdError}
          onPasswordEnter={(pw) => {
            this.handlePassword(pw);
          }}
          onPasswordDelete={() => {
            this.handleAppReset();
          }}
        />
      </div>
    );
  }
}

class DataTable extends React.Component {
  render() {
    return (
      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr className="data-head">
              <DataHeadCell
                text="Row#"
                error={this.props.table.tbl_errors.find((x) => {
                  return (
                    x.row === null && (x.column == "row" || x.column === null)
                  );
                })}
              />
              <DataHeadCell
                text="Work Item Name"
                error={this.props.table.tbl_errors.find((x) => {
                  return (
                    x.row === null && (x.column == "name" || x.column === null)
                  );
                })}
              />
              <DataHeadCell
                text="Start"
                error={this.props.table.tbl_errors.find((x) => {
                  return (
                    x.row === null && (x.column == "start" || x.column === null)
                  );
                })}
              />
              <DataHeadCell
                text="End"
                error={this.props.table.tbl_errors.find((x) => {
                  return (
                    x.row === null && (x.column == "end" || x.column === null)
                  );
                })}
              />
              <DataHeadCell
                text="Notes"
                error={this.props.table.tbl_errors.find((x) => {
                  return (
                    x.row === null && (x.column == "note" || x.column === null)
                  );
                })}
              />
              <DataHeadCell
                text="Task ID"
                error={this.props.table.tbl_errors.find((x) => {
                  return (
                    x.row === null && (x.column == "task" || x.column === null)
                  );
                })}
              />
              <DataHeadCell text="Customer" error={false} />
              <DataHeadCell text="Project" error={false} />
              <DataHeadCell text="Content" error={false} />
            </tr>
          </thead>
          <tbody>
            {this.props.table.tbl_data.map((row) => (
              <tr key={row.row.value}>
                <DataTableCell cell_data={row.row} />
                <DataTableCell cell_data={row.name} />
                <DataTableCell cell_data={row.start} />
                <DataTableCell cell_data={row.end} />
                <DataTableCell cell_data={row.note} />
                <DataTableCell cell_data={row.task} />
                <DataTableCell cell_data={row.teamwork_customer} />
                <DataTableCell cell_data={row.teamwork_project} />
                <DataTableCell cell_data={row.teamwork_content} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
}

class DataHeadCell extends React.Component {
  render() {
    return (
      <th
        className={
          "data-head-cell tooltip-host" +
          (this.props.error
            ? " " + this.props.error.severity.toLowerCase()
            : "")
        }
      >
        {this.props.text}
        <span className="tooltiptext">
          {this.props.error ? this.props.error.message : this.props.text}
        </span>
      </th>
    );
  }
}

class DataTableCell extends React.Component {
  render() {
    return (
      <td
        className={
          "data-table-cell tooltip-host" +
          (this.props.cell_data.error
            ? " " + this.props.cell_data.error.severity.toLowerCase()
            : "")
        }
      >
        {this.props.cell_data.value}
        <span className="tooltiptext">
          {this.props.cell_data.error
            ? this.props.cell_data.error.message
            : this.props.cell_data.value}
        </span>
      </td>
    );
  }
}

class ErrorList extends React.Component {
  render() {
    var i = 0;
    return (
      <ul className="error-list">
        {this.props.errors.map((e) => (
          <ErrorListItem key={`eli_${i++}`} error={e} />
        ))}
      </ul>
    );
  }
}

class ErrorListItem extends React.Component {
  render() {
    return (
      <li className={"error-list-item " + this.props.error.severity}>
        {`${this.props.error.severity}: `}
        {this.props.error.row !== null ? `Row: '${this.props.error.row}' ` : ""}
        {this.props.error.column !== null
          ? `Column: '${this.props.error.column}' `
          : ""}
        {this.props.error.message !== null
          ? `>> ${this.props.error.message}`
          : ""}
      </li>
    );
  }
}

class ConfigMenu extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      open: true,
    };
  }

  toggleOpen() {
    var s = this.state;
    s.open = !s.open;
    this.setState(s);
  }

  render() {
    return (
      <div className={"config-menu" + (this.state.open ? " conf-open" : "")}>
        <div
          className={"conf-toggle" + (this.state.open ? " conf-open" : "")}
          onClick={() => {
            this.toggleOpen();
          }}
        >
          <div className="bar1"></div>
          <div className="bar2"></div>
          <div className="bar3"></div>
        </div>
        <h2 className={"conf-header" + (this.state.open ? " conf-open" : "")}>
          <center>Configuration</center>
        </h2>
        <ConfigOption
          text="Url"
          id="base_url"
          value={this.props.config.base_url}
          onChange={(key, value) => {
            this.props.onConfKeyUpdate(key, value);
          }}
        />
        <ConfigOption
          text="Teamwork Token"
          id="token"
          value={this.props.config.token}
          onChange={(key, value) => {
            this.props.onConfKeyUpdate(key, value);
          }}
        />
        <div align="right">
          <button
            className="password-reset-button"
            onClick={() => this.props.onPwdReset()}
          >
            Reset Password
          </button>
        </div>
        <ConfigOption
          text="Work Item Column"
          id="winame_col"
          value={this.props.config.winame_col}
          onChange={(key, value) => {
            this.props.onConfKeyUpdate(key, value);
          }}
        />
        <ConfigOption
          text="Start Time Column"
          id="start_col"
          value={this.props.config.start_col}
          onChange={(key, value) => {
            this.props.onConfKeyUpdate(key, value);
          }}
        />
        <ConfigOption
          text="End Time Column"
          id="end_col"
          value={this.props.config.end_col}
          onChange={(key, value) => {
            this.props.onConfKeyUpdate(key, value);
          }}
        />
        <ConfigOption
          text="Task ID Column"
          id="task_col"
          value={this.props.config.task_col}
          onChange={(key, value) => {
            this.props.onConfKeyUpdate(key, value);
          }}
        />
        <ConfigOption
          text="Notes Column"
          id="notes_col"
          value={this.props.config.notes_col}
          onChange={(key, value) => {
            this.props.onConfKeyUpdate(key, value);
          }}
        />
        <ConfigOption
          text="Date-Time Pattern"
          id="date_pattern"
          value={this.props.config.date_pattern}
          onChange={(key, value) => {
            this.props.onConfKeyUpdate(key, value);
          }}
        />
        <div align="center">
          <button
            onClick={() => this.props.onConfSave()}
            className="conf-option"
          >
            Save
          </button>
        </div>
      </div>
    );
  }
}

class ConfigOption extends React.Component {
  render() {
    return (
      <div className="conf-option">
        <span className="conf-label">{this.props.text}</span>
        <input
          className="conf-text-input"
          id={this.props.id}
          value={this.props.value}
          onChange={(e) => this.props.onChange(this.props.id, e.target.value)}
        />
      </div>
    );
  }
}

class PasswordDialog extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      password: "",
    };
  }

  handlePwdInputChange(pwd) {
    let s = this.state;
    s.password = pwd;
    this.setState(s);
  }

  passwordDeleteClicked() {
    if (
      confirm(
        "You can reset your passwort, but you will have to re-enter your api token afterwards. OK?"
      ) == true
    ) {
      this.props.onPasswordDelete();
    }
  }

  render() {
    return (
      <div
        className={
          "password-dialog" +
          (["UNINIT", "LOCKED"].includes(this.props.appState)
            ? " pw-dialog-open"
            : "")
        }
      >
        <div className="password-box">
          <h2 className="password-prompt-head">
            {["UNINIT"].includes(this.props.appState)
              ? "Enter New Password"
              : "Enter Application Password"}
          </h2>
          <p>This password is used to protect your Teamwork API key.</p>
          <div className="pwd-input-box">
            <input
              className={
                "conf-text-input" + (this.props.pwdError ? " error" : "")
              }
              value={this.state.password}
              onChange={(e) => this.handlePwdInputChange(e.target.value)}
              id="password"
              type="password"
              placeholder="password"
            />
          </div>
          <div className="pwd-button-box" align="center">
            <button
              onClick={() => this.props.onPasswordEnter(this.state.password)}
              className="conf-option"
            >
              OK
            </button>
          </div>
          <div
            className={
              "pwd-delete-box" + (this.props.pwdError ? "" : " hidden")
            }
            align="center"
          >
            <a
              href="#"
              alt="Reset the application. You will have re-enter your api token."
              className="pwd-delete-link"
              onClick={() => this.passwordDeleteClicked()}
            >
              Lost Password?
            </a>
          </div>
        </div>
      </div>
    );
  }
}

const container = document.getElementById("root");

const app = ReactDOM.render(<TeamworkSync />, container);

document.addEventListener("drop", (event) => {
  event.preventDefault();
  event.stopPropagation();

  if (event.dataTransfer.files.length > 0) {
    window.electronAPI.openFileDrop(event.dataTransfer.files[0].path);
  }
});

document.addEventListener("dragover", (e) => {
  e.preventDefault();
  e.stopPropagation();
});

window.electronAPI.registerSetTable((event, value) => {
  app.setTable(value);
});

window.electronAPI.registerSetConfig((event, value) => {
  app.updateConfig(value);
});

window.electronAPI.registerSetErrors((event, value) => {
  app.setErrors(value);
});

window.electronAPI.registerSetAppState((event, value) => {
  app.setAppState(value);
});
