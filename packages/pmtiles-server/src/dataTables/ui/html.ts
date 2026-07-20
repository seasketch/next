/**
 * A self-contained demo UI for exercising the query engine. Served when the
 * query endpoint is requested with Accept: text/html (or f=html). The page
 * loads ../column-stats.json (proxied by this worker, with CDN fallback) to
 * populate column pickers, then runs queries against the same endpoint with
 * f=json.
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function queryUiHtml(tablePath: string): string {
  const safePath = escapeHtml(tablePath);
  const tablePathJs = JSON.stringify(tablePath);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Data Table Query &mdash; ${safePath}</title>
<style>
  :root {
    --bg: #f6f7f9; --panel: #ffffff; --border: #e2e5ea; --text: #1d2530;
    --muted: #6b7482; --accent: #1d4ed8; --accent-soft: #e8eefc;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--bg); color: var(--text);
    font: 14px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  .wrap { max-width: 1000px; margin: 0 auto; padding: 24px 16px 64px; }
  h1 { font-size: 18px; margin: 0 0 2px; }
  .subtitle { color: var(--muted); font-size: 12px; font-family: ui-monospace, monospace; word-break: break-all; }
  .header-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
  .header-actions a {
    font-size: 12px; text-decoration: none; color: var(--accent);
    border: 1px solid var(--border); border-radius: 6px; padding: 5px 10px; background: #fff;
  }
  .header-actions a:hover { background: var(--accent-soft); }
  .panel {
    background: var(--panel); border: 1px solid var(--border);
    border-radius: 10px; padding: 16px; margin-top: 16px;
  }
  .panel h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); margin: 0 0 10px; }
  label { font-size: 12px; color: var(--muted); display: block; margin-bottom: 2px; }
  select, input[type=text], input[type=number] {
    font: inherit; padding: 6px 8px; border: 1px solid var(--border);
    border-radius: 6px; background: #fff; min-width: 0;
  }
  .row { display: flex; gap: 8px; align-items: flex-end; flex-wrap: wrap; margin-bottom: 8px; }
  .filters .row { background: var(--bg); padding: 8px; border-radius: 8px; }
  button {
    font: inherit; border: 1px solid var(--border); border-radius: 6px;
    background: #fff; padding: 6px 12px; cursor: pointer;
  }
  button:hover { background: var(--accent-soft); }
  button.primary { background: var(--accent); border-color: var(--accent); color: #fff; font-weight: 600; padding: 8px 20px; }
  button.primary:hover { opacity: 0.9; }
  button.remove { color: #b91c1c; border: none; background: none; font-size: 16px; padding: 4px 8px; }
  .checkboxes { display: flex; gap: 12px; flex-wrap: wrap; }
  .checkboxes label { display: flex; align-items: center; gap: 4px; margin: 0; color: var(--text); font-size: 13px; }
  .url-box {
    font-family: ui-monospace, monospace; font-size: 12px; background: #0f172a; color: #e2e8f0;
    padding: 10px 12px; border-radius: 8px; word-break: break-all; margin-top: 12px;
  }
  .url-box a { color: #7dd3fc; text-decoration: none; }
  table.results { border-collapse: collapse; width: 100%; margin-top: 8px; font-size: 13px; }
  table.results th, table.results td {
    border: 1px solid var(--border); padding: 5px 9px; text-align: left; white-space: nowrap;
  }
  table.results th { background: var(--bg); position: sticky; top: 0; }
  .results-scroll { max-height: 480px; overflow: auto; margin-top: 8px; border-radius: 8px; }
  .meta { color: var(--muted); font-size: 12px; margin-top: 8px; }
  .error { color: #b91c1c; margin-top: 8px; white-space: pre-wrap; }
  .hint { color: var(--muted); font-size: 12px; }
  .loading { display: flex; align-items: center; gap: 8px; color: var(--muted); padding: 10px 0; }
  .spinner {
    width: 14px; height: 14px; border-radius: 50%;
    border: 2px solid var(--border); border-top-color: var(--accent);
    animation: spin 0.7s linear infinite; flex: none;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  button.primary:disabled { opacity: 0.6; cursor: default; }
  .panel-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
  .panel-head h2 { margin: 0 0 10px; }
  button.link {
    border: none; background: none; color: var(--accent); padding: 0;
    font-size: 12px; text-decoration: underline; cursor: pointer;
  }
</style>
</head>
<body>
<div class="wrap">
  <h1>Data Table Query</h1>
  <div class="subtitle">${safePath}</div>
  <div class="header-actions">
    <a href="data.parquet" download="data.parquet">Download parquet</a>
    <a href="column-stats.json" download="column-stats.json">Download metadata</a>
  </div>

  <div class="panel filters">
    <div class="panel-head">
      <h2>Filters</h2>
      <button type="button" id="reset" class="link">Reset saved query</button>
    </div>
    <div id="filters"></div>
    <button type="button" id="add-filter">+ Add filter</button>
    <div class="hint">This form is saved in your browser and restored automatically next time you open this table.</div>
  </div>

  <div class="panel">
    <h2>Aggregation</h2>
    <div class="row">
      <div>
        <label>Group by</label>
        <div class="checkboxes" id="group-by"></div>
      </div>
    </div>
    <div class="row">
      <div>
        <label>Operations</label>
        <div class="checkboxes" id="ops"></div>
      </div>
      <div>
        <label for="agg-column">Column</label>
        <select id="agg-column"><option value="">(none)</option></select>
      </div>
    </div>
    <div class="hint">Leave operations unchecked to fetch raw filtered rows.</div>
  </div>

  <div class="panel">
    <h2>Output</h2>
    <div class="row">
      <div><label for="order-by">Order by</label><select id="order-by"><option value="">(none)</option></select></div>
      <div><label for="order-dir">Direction</label>
        <select id="order-dir"><option value="asc">asc</option><option value="desc">desc</option></select></div>
      <div><label for="limit">Limit</label><input type="number" id="limit" min="1" placeholder="no limit" style="width:90px" /></div>
      <div><label for="offset">Offset</label><input type="number" id="offset" value="0" min="0" style="width:90px" /></div>
      <button type="button" class="primary" id="run">Run query</button>
    </div>
    <div class="url-box" id="url"></div>
    <div id="output"></div>
  </div>
</div>

<script>
(function () {
  "use strict";
  var stats = null;
  var columns = [];
  var STORAGE_KEY = "pmtiles-server:data-tables-query-ui:v1:" + ${tablePathJs};
  var OPS = ["count", "sum", "mean", "min", "max", "median"];
  var STRING_OPS = [["eq", "="], ["neq", "\\u2260"], ["in", "in"], ["is.null", "is null"], ["not.null", "not null"]];
  var NUMBER_OPS = [["eq", "="], ["neq", "\\u2260"], ["gt", ">"], ["gte", "\\u2265"], ["lt", "<"], ["lte", "\\u2264"], ["in", "in"], ["is.null", "is null"], ["not.null", "not null"]];

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "text") node.textContent = attrs[k];
      else node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { node.appendChild(c); });
    return node;
  }

  function columnInfo(name) {
    return columns.find(function (c) { return c.attribute === name; });
  }

  function buildFilterRow(saved) {
    var row = el("div", { class: "row" });
    var colSel = el("select", { class: "f-col" });
    columns.forEach(function (c) {
      colSel.appendChild(el("option", { value: c.attribute, text: c.attribute + " (" + c.type + ")" }));
    });
    var opSel = el("select", { class: "f-op" });
    var valWrap = el("span", { class: "f-val-wrap" });

    function rebuildOps() {
      var info = columnInfo(colSel.value);
      var ops = info && info.type === "number" ? NUMBER_OPS : STRING_OPS;
      opSel.innerHTML = "";
      ops.forEach(function (o) {
        opSel.appendChild(el("option", { value: o[0], text: o[1] }));
      });
      rebuildValue();
    }

    function rebuildValue() {
      valWrap.innerHTML = "";
      if (opSel.value === "is.null" || opSel.value === "not.null") return;
      var info = columnInfo(colSel.value);
      var distinct = info && info.values ? Object.keys(info.values) : [];
      if (distinct.length > 0 && distinct.length <= 50 && opSel.value !== "in") {
        var sel = el("select", { class: "f-val" });
        distinct.forEach(function (v) { sel.appendChild(el("option", { value: v, text: v })); });
        valWrap.appendChild(sel);
      } else {
        var input = el("input", { type: "text", class: "f-val", placeholder: opSel.value === "in" ? "value1,value2,..." : "value" });
        if (distinct.length > 0 && distinct.length <= 200) {
          var listId = "dl-" + Math.random().toString(36).slice(2);
          var dl = el("datalist", { id: listId });
          distinct.forEach(function (v) { dl.appendChild(el("option", { value: v })); });
          input.setAttribute("list", listId);
          valWrap.appendChild(dl);
        }
        valWrap.appendChild(input);
        if (info && info.min !== undefined) {
          valWrap.appendChild(el("span", { class: "hint", text: " " + info.min + " \\u2013 " + info.max }));
        }
      }
      updateUrl();
    }

    colSel.addEventListener("change", rebuildOps);
    opSel.addEventListener("change", rebuildValue);
    row.appendChild(el("div", {}, [el("label", { text: "Column" }), colSel]));
    row.appendChild(el("div", {}, [el("label", { text: "Op" }), opSel]));
    row.appendChild(el("div", {}, [el("label", { text: "Value" }), valWrap]));
    var removeBtn = el("button", { type: "button", class: "remove", title: "Remove filter", text: "\\u00d7" });
    removeBtn.addEventListener("click", function () { row.remove(); updateUrl(); });
    row.appendChild(removeBtn);

    if (saved && saved.column && columnInfo(saved.column)) {
      colSel.value = saved.column;
    }
    rebuildOps();
    if (saved && saved.op) {
      var hasOp = Array.prototype.some.call(opSel.options, function (o) { return o.value === saved.op; });
      if (hasOp) opSel.value = saved.op;
    }
    rebuildValue();
    if (saved && saved.value !== undefined) {
      var valEl = row.querySelector(".f-val");
      if (valEl) valEl.value = saved.value;
    }
    return row;
  }

  function buildQueryString() {
    var params = new URLSearchParams();
    document.querySelectorAll("#filters .row").forEach(function (row) {
      var col = row.querySelector(".f-col").value;
      var op = row.querySelector(".f-op").value;
      var valEl = row.querySelector(".f-val");
      if (op === "is.null" || op === "not.null") {
        params.append("q." + col, op);
      } else if (valEl && valEl.value !== "") {
        if (op === "in") {
          var items = valEl.value.split(",").map(function (s) { return s.trim(); }).filter(Boolean)
            .map(function (s) { return s.indexOf(",") >= 0 || s.indexOf('"') >= 0 ? '"' + s.replace(/"/g, '""') + '"' : s; });
          params.append("q." + col, "in.(" + items.join(",") + ")");
        } else if (op === "eq") {
          params.append("q." + col, valEl.value);
        } else {
          params.append("q." + col, op + "." + valEl.value);
        }
      }
    });
    var groupBy = [];
    document.querySelectorAll("#group-by input:checked").forEach(function (cb) { groupBy.push(cb.value); });
    if (groupBy.length) params.set("groupBy", groupBy.join(","));
    var ops = [];
    document.querySelectorAll("#ops input:checked").forEach(function (cb) { ops.push(cb.value); });
    if (ops.length) params.set("op", ops.join(","));
    var aggCol = document.getElementById("agg-column").value;
    if (aggCol && ops.length) params.set("column", aggCol);
    var orderBy = document.getElementById("order-by").value;
    if (orderBy) params.set("orderBy", orderBy + ":" + document.getElementById("order-dir").value);
    var limit = document.getElementById("limit").value;
    if (limit) params.set("limit", limit);
    var offset = document.getElementById("offset").value;
    if (offset && offset !== "0") params.set("offset", offset);
    return params;
  }

  function serializeState() {
    var filters = [];
    document.querySelectorAll("#filters .row").forEach(function (row) {
      var valEl = row.querySelector(".f-val");
      filters.push({
        column: row.querySelector(".f-col").value,
        op: row.querySelector(".f-op").value,
        value: valEl ? valEl.value : "",
      });
    });
    var groupBy = [];
    document.querySelectorAll("#group-by input:checked").forEach(function (cb) { groupBy.push(cb.value); });
    var ops = [];
    document.querySelectorAll("#ops input:checked").forEach(function (cb) { ops.push(cb.value); });
    return {
      filters: filters,
      groupBy: groupBy,
      ops: ops,
      aggColumn: document.getElementById("agg-column").value,
      orderBy: document.getElementById("order-by").value,
      orderDir: document.getElementById("order-dir").value,
      limit: document.getElementById("limit").value,
      offset: document.getElementById("offset").value,
    };
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeState()));
    } catch (e) {
      // localStorage unavailable (private browsing, quota, etc) -- non-fatal
    }
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function clearState() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
  }

  function updateOrderByOptions() {
    var sel = document.getElementById("order-by");
    var current = sel.value;
    sel.innerHTML = "";
    sel.appendChild(el("option", { value: "", text: "(none)" }));
    var groupBy = [];
    document.querySelectorAll("#group-by input:checked").forEach(function (cb) { groupBy.push(cb.value); });
    var ops = [];
    document.querySelectorAll("#ops input:checked").forEach(function (cb) { ops.push(cb.value); });
    var keys = ops.length ? groupBy.concat(ops) : columns.map(function (c) { return c.attribute; });
    keys.forEach(function (k) { sel.appendChild(el("option", { value: k, text: k })); });
    if (keys.indexOf(current) >= 0) sel.value = current;
  }

  function updateUrl() {
    updateOrderByOptions();
    var params = buildQueryString();
    params.set("f", "json");
    var href = "query?" + params.toString();
    var box = document.getElementById("url");
    box.innerHTML = "";
    box.appendChild(el("a", { href: href, target: "_blank", text: new URL(href, location.href).toString() }));
    saveState();
  }

  function renderResults(data) {
    var out = document.getElementById("output");
    out.innerHTML = "";
    var items = data.groups || data.rows || [];
    var meta = el("div", { class: "meta", text:
      items.length + (data.groups ? " groups" : " rows") +
      " \\u00b7 scanned " + data.rowsScanned.toLocaleString() + " of " + data.totalRows.toLocaleString() + " rows" +
      " \\u00b7 matched " + data.rowsMatched.toLocaleString() +
      " \\u00b7 row groups " + data.rowGroups.scanned + "/" + data.rowGroups.total +
      " \\u00b7 " + data.timing.totalMs + "ms (metadata " + data.timing.metadataMs + "ms)" });
    out.appendChild(meta);
    if (!items.length) return;
    var cols = Object.keys(items[0]);
    var table = el("table", { class: "results" });
    var thead = el("thead", {}, [el("tr", {}, cols.map(function (c) { return el("th", { text: c }); }))]);
    var tbody = el("tbody");
    items.forEach(function (item) {
      tbody.appendChild(el("tr", {}, cols.map(function (c) {
        var v = item[c];
        var text = v === null || v === undefined ? "" :
          typeof v === "number" && !Number.isInteger(v) ? v.toFixed(3) : String(v);
        return el("td", { text: text });
      })));
    });
    table.appendChild(thead);
    table.appendChild(tbody);
    var scroll = el("div", { class: "results-scroll" }, [table]);
    out.appendChild(scroll);
  }

  function run() {
    var params = buildQueryString();
    params.set("f", "json");
    var out = document.getElementById("output");
    var runBtn = document.getElementById("run");
    out.innerHTML = "";
    out.appendChild(el("div", { class: "loading" }, [
      el("div", { class: "spinner" }),
      el("span", { text: "Running query\\u2026 new filter combinations can take a moment the first time; repeat queries are much faster." }),
    ]));
    runBtn.setAttribute("disabled", "disabled");
    var t0 = performance.now();
    fetch("query?" + params.toString(), { headers: { accept: "application/json" } })
      .then(function (res) { return res.json().then(function (body) { return { res: res, body: body }; }); })
      .then(function (r) {
        if (!r.res.ok) {
          out.innerHTML = "";
          out.appendChild(el("div", { class: "error", text: "Error " + r.res.status + ": " + (r.body.error || "") +
            (r.body.validColumns ? "\\nValid columns: " + r.body.validColumns.map(function (c) { return c.name; }).join(", ") : "") }));
          return;
        }
        renderResults(r.body);
        var wall = Math.round(performance.now() - t0);
        var meta = out.querySelector(".meta");
        if (meta) meta.textContent += " \\u00b7 request " + wall + "ms";
      })
      .catch(function (err) {
        out.innerHTML = "";
        out.appendChild(el("div", { class: "error", text: String(err) }));
      })
      .then(function () {
        runBtn.removeAttribute("disabled");
      });
  }

  function init(data) {
    stats = data;
    columns = data.columns || [];
    var groupBy = document.getElementById("group-by");
    columns.forEach(function (c) {
      var cb = el("input", { type: "checkbox", value: c.attribute });
      cb.addEventListener("change", updateUrl);
      groupBy.appendChild(el("label", {}, [cb, document.createTextNode(c.attribute)]));
    });
    var opsWrap = document.getElementById("ops");
    OPS.forEach(function (op) {
      var cb = el("input", { type: "checkbox", value: op });
      cb.addEventListener("change", updateUrl);
      opsWrap.appendChild(el("label", {}, [cb, document.createTextNode(op)]));
    });
    var aggCol = document.getElementById("agg-column");
    columns.filter(function (c) { return c.type === "number"; }).forEach(function (c) {
      aggCol.appendChild(el("option", { value: c.attribute, text: c.attribute }));
    });
    aggCol.addEventListener("change", updateUrl);
    ["order-by", "order-dir", "limit", "offset"].forEach(function (id) {
      document.getElementById(id).addEventListener("change", updateUrl);
    });
    document.getElementById("add-filter").addEventListener("click", function () {
      document.getElementById("filters").appendChild(buildFilterRow());
      updateUrl();
    });
    document.getElementById("run").addEventListener("click", run);
    document.getElementById("reset").addEventListener("click", function () {
      clearState();
      document.getElementById("filters").innerHTML = "";
      document.querySelectorAll("#group-by input, #ops input").forEach(function (cb) { cb.checked = false; });
      aggCol.value = "";
      document.getElementById("order-dir").value = "asc";
      document.getElementById("limit").value = "";
      document.getElementById("offset").value = "0";
      updateUrl();
    });
    document.getElementById("filters").addEventListener("change", updateUrl);

    var saved = loadState();
    var filtersEl = document.getElementById("filters");
    (saved && saved.filters || []).forEach(function (f) {
      if (f.column && columnInfo(f.column)) {
        filtersEl.appendChild(buildFilterRow(f));
      }
    });
    if (saved) {
      document.querySelectorAll("#group-by input").forEach(function (cb) {
        cb.checked = saved.groupBy && saved.groupBy.indexOf(cb.value) >= 0;
      });
      document.querySelectorAll("#ops input").forEach(function (cb) {
        cb.checked = saved.ops && saved.ops.indexOf(cb.value) >= 0;
      });
      if (saved.aggColumn && columnInfo(saved.aggColumn)) aggCol.value = saved.aggColumn;
      updateOrderByOptions();
      if (saved.orderBy) document.getElementById("order-by").value = saved.orderBy;
      if (saved.orderDir) document.getElementById("order-dir").value = saved.orderDir;
      if (saved.limit) document.getElementById("limit").value = saved.limit;
      if (saved.offset) document.getElementById("offset").value = saved.offset;
    }
    updateUrl();
  }

  fetch("column-stats.json", { headers: { accept: "application/json" } })
    .then(function (res) {
      if (!res.ok) throw new Error("column-stats.json not found (" + res.status + ")");
      return res.json();
    })
    .then(init)
    .catch(function (err) {
      document.getElementById("output").appendChild(
        el("div", { class: "error", text: "Failed to load column metadata: " + String(err) }));
    });
})();
</script>
</body>
</html>`;
}
