class TeamworkSync extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      table: { tbl_data: [], tbl_errors: [] },
      file_path: null,
      config: { teamwork_token: "foo" },
    };
  }

  handle_config_change(conf) {
    var s = this.state;
    s.config.teamwork_token = conf;
    this.setState(s);
    console.log(JSON.stringify(conf));
  }

  set_table(data) {
    var s = this.state;
    s.table = data || { tbl_data: [], tbl_errors: [] };
    this.setState(s);
  }

  async load_csv() {
    const filePath = await window.electronAPI.open_file_dialog();
    var s = this.state;
    s.file_path = filePath || null;
    this.setState(s);
  }

  render() {
    return (
      <div>
        <div className="load-section">
          <button
            type="button"
            onClick={() => {
              this.load_csv();
            }}
          >
            Load CSV
          </button>
          <strong>{this.state.file_path || ""}</strong>
        </div>
        <DataTable table={this.state.table} />
        <div className="send-section">
          <button
            type="button"
            disabled={
              this.state.table.tbl_errors.filter((x) => {
                return x.severity == "ERROR";
              }).length > 0 || this.state.table.tbl_data.length <= 0
            }
            onClick={() => {
              this.send_data();
            }}
          >
            Submit to Teamwork
          </button>
        </div>
        <div className="config-menu">
          <ConfigMenu
            config={this.state.config}
            onConfChange={(conf) => this.handle_config_change(conf)}
          />
        </div>
      </div>
    );
  }
}

class DataTable extends React.Component {
  render() {
    return (
      <table className="data-table">
        <thead>
          <tr>
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
              text="TeamworkTask"
              error={this.props.table.tbl_errors.find((x) => {
                return (
                  x.row === null && (x.column == "task" || x.column === null)
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
          </tr>
        </thead>
        <tbody>
          {this.props.table.tbl_data.map((row) => (
            <tr key={row.row.value}>
              <DataTableCell cell_data={row.row} />
              <DataTableCell cell_data={row.name} />
              <DataTableCell cell_data={row.start} />
              <DataTableCell cell_data={row.end} />
              <DataTableCell cell_data={row.task} />
              <DataTableCell cell_data={row.note} />
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
}

class DataHeadCell extends React.Component {
  render() {
    return (
      <th
        className={
          "tooltip-host" +
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
          "tooltip-host" +
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

class ConfigMenu extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      config: { teamwork_token: this.props.config.teamwork_token },
    };
  }

  update_conf_value(key, value) {
    var s = this.state;
    s["config"][key] = value;
    this.setState(s);
  }

  save_config() {
    this.props.onConfChange(this.state.config);
  }

  render() {
    return (
      <div>
        <h2><center>Configuration</center></h2>
        <div>
          <span>Teamwork Token: </span>
          <input
            id="TeamworkToken"
            value={this.state.config.teamwork_token}
            onChange={(e) =>
              this.update_conf_value("teamwork_token", e.target.value)
            }
          />
        </div>
        <div align="center">
          <button onClick={() => this.save_config()}>Save</button>
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
    window.electronAPI.open_file_drop(event.dataTransfer.files[0].path);
  }
});

document.addEventListener("dragover", (e) => {
  e.preventDefault();
  e.stopPropagation();
});

window.electronAPI.register_set_table((event, value) => {
  app.set_table(value);
});
