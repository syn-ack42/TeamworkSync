class TeamworkSync extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      table: { tbl_data: [], tbl_errors: [] },
      file_path: null,
      config: {
        base_url: "https://aspiresoftware.eu.teamwork.com",
        token: "fds",
        winame_col: "Work Item",
        start_col: "Start",
        end_col: "End",
        task_col: "TeamworkTask",
        notes_col: "Notes",
        date_pattern: "dd.MM.yyyy HH:mm:ss"
      }
    };
  }

  handle_config_save() {
    window.electronAPI.store_config(this.state.config);
  }

  update_conf_key(key, value) {
    var s = this.state;
    s.config[key] = value;
    this.setState(s);
  }

  update_config(conf) {
    var s = this.state;
    s.config = conf;
    this.setState(s);
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
            onConfKeyUpdate={(key, value) => this.update_conf_key(key, value)}
            onConfSave={(conf) => this.handle_config_save(conf)}
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
            <DataHeadCell
              text="Customer"
              error={false}
            />
            <DataHeadCell
              text="Project"
              error={false}
            />
            <DataHeadCell
              text="Content"
              error={false}
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
              <DataTableCell cell_data={row.note} />
              <DataTableCell cell_data={row.task} />
              <DataTableCell cell_data={row.teamwork_customer} />
              <DataTableCell cell_data={row.teamwork_project} />
              <DataTableCell cell_data={row.teamwork_content} />
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

  render() {

    return (
      <div>
        <h2><center>Configuration</center></h2>
        <ConfigOption text="Url" id="base_url" value={this.props.config.base_url} onChange={(key, value) => { this.props.onConfKeyUpdate(key, value) }} />
        <ConfigOption text="Teamwork Token" id="token" value={this.props.config.token} onChange={(key, value) => { this.props.onConfKeyUpdate(key, value) }} />
        <ConfigOption text="Work Item Column" id="winame_col" value={this.props.config.winame_col} onChange={(key, value) => { this.props.onConfKeyUpdate(key, value) }} />
        <ConfigOption text="Start Time Column" id="start_col" value={this.props.config.start_col} onChange={(key, value) => { this.props.onConfKeyUpdate(key, value) }} />
        <ConfigOption text="End Time Column" id="end_col" value={this.props.config.end_col} onChange={(key, value) => { this.props.onConfKeyUpdate(key, value) }} />
        <ConfigOption text="Task ID Column" id="task_col" value={this.props.config.task_col} onChange={(key, value) => { this.props.onConfKeyUpdate(key, value) }} />
        <ConfigOption text="Notes Column" id="notes_col" value={this.props.config.notes_col} onChange={(key, value) => { this.props.onConfKeyUpdate(key, value) }} />
        <ConfigOption text="Date-Time Pattern" id="date_pattern" value={this.props.config.date_pattern} onChange={(key, value) => { this.props.onConfKeyUpdate(key, value) }} />
        <div align="center">
          <button onClick={() => this.props.onConfSave()}>Save</button>
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
        <input className="conf-text-input"
          id={this.props.id}
          value={this.props.value}
          onChange={(e) =>
            this.props.onChange(this.props.id, e.target.value)
          }
        />
      </div>
    )
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

window.electronAPI.register_set_config((event, value) => {
  app.update_config(value)
});
