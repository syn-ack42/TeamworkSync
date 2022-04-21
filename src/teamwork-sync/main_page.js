class TeamworkSync extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      table: {tbl_data:[], tbl_errors: []},
      file_path: null
    };
  }

  set_table(data) {
      var s = this.state
      s.table = data || {tbl_data:[], tbl_errors: []};
      this.setState(s)
  }

  async load_csv() {
    const filePath = await window.electronAPI.open_file_dialog();
    var s = this.state;
    s.file_path = filePath || null
    this.setState(s)
  }

  render() {
    return (
      <div>
        <div className="load-section">
          <button type="button" onClick={() => {this.load_csv()}}>
            Load CSV
          </button>
          <strong>{this.state.file_path || ""}</strong>
        </div>
        <DataTable table={this.state.table} />
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
            <th className="head-info" id="RowNumHead">
              Row#
            </th>
            <th className="head-info" id="TaskNameHead">
              Task Name
            </th>
            <th className="head-import" id="StartHead">
              Start
            </th>
            <th className="head-import" id="EndHead">
              End
            </th>
            <th className="head-import" id="NotesHead">
              Notes
            </th>
            <th className="head-import" id="TeamworkTaskHead">
              TeamworkTask
            </th>
          </tr>
        </thead>
        <tbody>
          {this.props.table.tbl_data.map((row) => (
            <tr key={row.row.value}>
              <td>{row.row.value}</td>
              <td>{row.name.value}</td>
              <td>{row.start.value}</td>
              <td>{row.end.value}</td>
              <td>{row.task.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
}

const container = document.getElementById("root");

const app = ReactDOM.render(<TeamworkSync />, container);

$("#load_csv").click(async () => {
  const filePath = await window.electronAPI.open_file_dialog();
  $("#filePath").text(filePath);
});

document.addEventListener("drop", (event) => {
  event.preventDefault();
  event.stopPropagation();

  for (const f of event.dataTransfer.files) {
    // Using the path attribute to get absolute file path
    console.log("File Path of dragged files: ", f.path);
    $("#filePath").text(f.path);
    window.electronAPI.open_file_drop(f.path);
  }
});

document.addEventListener("dragover", (e) => {
  e.preventDefault();
  e.stopPropagation();
});

window.electronAPI.set_table((event, value) => {
  app.set_table(value);
});
