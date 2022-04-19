

class DataTable extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      table_data: [],
    };
  }

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
          {this.state.table_data.map((row) => (
            <tr>
              <td>{row.row}</td>
              <td>{row.name}</td>
              <td>{row.start}</td>
              <td>{row.end}</td>
              <td>{row.task}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
}

const container = document.getElementById("root");

const tbl = ReactDOM.render(<DataTable id="dtable" />, container);

function set_errors(errs) {
  $("#errors").text(errs);
}


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
  tbl.setState({ table_data: value });

  return;



  $("#data_table").html("");
  if (value.length == 0) {
    return;
  }
  var t = $("<table>");
  var hd = $("<tr>");
  const headers = [];
  for (const k in value[0]) {
    headers.push(k);
    hd.append($("<th>").html(k));
  }
  t.append(hd);
  var i = 0;
  $.each(value, (r) => {
    const row = value[r];
    const tr = $("<tr>").attr("id", row["row"]);
    for (const h in headers) {
      tr.append(
        $("<td>")
          .html(row[headers[h]])
          .attr("id", `${row["row"]}_${headers[h]}`)
      );
    }
    t.append(tr);
  });
  $("#data_table").append(t);
});

window.electronAPI.set_errors((event, value) => {
  $("#errors").text(JSON.stringify(value));
});
