// admin-common.js — Shared admin session, helpers, and UI utilities

const savedUser = localStorage.getItem("smsUser");

if (!savedUser) {
  window.location.href = "login.html";
  throw new Error("No user session");
}

let admin = null;

try {
  admin = JSON.parse(savedUser);
} catch (e) {
  localStorage.removeItem("smsUser");
  window.location.href = "login.html";
  throw new Error("Invalid user data");
}

if (admin && admin.role !== "admin") {
  window.location.href = "user-dashboard.html";
  throw new Error("Unauthorized access");
}

// ── Fill header with admin info ───────────────────────────────
const dashboardName  = document.getElementById("dashboardName");
const dashboardEmail = document.getElementById("dashboardEmail");
const logoutButton   = document.getElementById("logoutButton");
const statusElement  = document.getElementById("dashboardStatus");

if (dashboardName)  dashboardName.textContent  = admin ? admin.full_name : "Administrator";
if (dashboardEmail) dashboardEmail.textContent = admin ? admin.email     : "-";

if (logoutButton) {
  logoutButton.addEventListener("click", function () {
    localStorage.removeItem("smsUser");
    window.location.href = "login.html";
  });
}

// ── Highlight active sidebar link ─────────────────────────────
var currentPage = document.body.dataset.page;
document.querySelectorAll(".sidebar-link").forEach(function (link) {
  link.classList.toggle("active", link.dataset.nav === currentPage);
});

// ── setStatus: inline message below header ────────────────────
function setStatus(message, type) {
  if (!statusElement) return;
  statusElement.textContent = message || "";
  statusElement.className   = "status-message";
  if (type) statusElement.classList.add(type);
}

// ── fetchJson: raw fetch returning { ok, data } ───────────────
async function fetchJson(url, options) {
  var response = await fetch(url, options || {});
  var data     = await response.json();
  return { ok: response.ok, data: data };
}

// ── submitJson: fetch with JSON body, throws on error ─────────
async function submitJson(url, method, payload) {
  var response = await fetch(url, {
    method:  method,
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(payload)
  });
  var data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(data.message || "Request failed.");
  }
  return data;
}

// ── renderTableBody: fill a <tbody> from row array ────────────
function renderTableBody(bodyId, rows, columns, emptyMessage) {
  var body = document.getElementById(bodyId);
  if (!body) return;

  body.innerHTML = "";

  if (!rows || rows.length === 0) {
    body.innerHTML = "<tr><td colspan=\"" + columns.length + "\">" + emptyMessage + "</td></tr>";
    return;
  }

  rows.forEach(function (row) {
    var tr = document.createElement("tr");
    tr.innerHTML = columns.map(function (col) {
      var val = row[col];
      return "<td>" + (val !== undefined && val !== null ? val : "-") + "</td>";
    }).join("");
    body.appendChild(tr);
  });
}

// ── fillSelect: populate a <select> from array ────────────────
function fillSelect(selectId, items, valueKey, labelBuilder, placeholder) {
  var select = document.getElementById(selectId);
  if (!select) return;

  var previousValue = select.value;
  select.innerHTML  = "";

  if (placeholder !== undefined) {
    var emptyOpt      = document.createElement("option");
    emptyOpt.value    = "";
    emptyOpt.textContent = placeholder;
    select.appendChild(emptyOpt);
  }

  items.forEach(function (item) {
    var opt      = document.createElement("option");
    opt.value    = item[valueKey];
    opt.textContent = labelBuilder(item);
    select.appendChild(opt);
  });

  if (previousValue) select.value = previousValue;
}

// ── Expose everything on window.AdminApp ─────────────────────
window.AdminApp = {
  admin:           admin,
  setStatus:       setStatus,
  fetchJson:       fetchJson,
  submitJson:      submitJson,
  renderTableBody: renderTableBody,
  fillSelect:      fillSelect
};