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

const dashboardName = document.getElementById("dashboardName");
const dashboardEmail = document.getElementById("dashboardEmail");
const logoutButton = document.getElementById("logoutButton");
const statusElement = document.getElementById("dashboardStatus");

if (dashboardName) {
  dashboardName.textContent = admin ? admin.full_name : "Administrator";
}

if (dashboardEmail) {
  dashboardEmail.textContent = admin ? admin.email : "-";
}

if (logoutButton) {
  logoutButton.addEventListener("click", () => {
    localStorage.removeItem("smsUser");
    window.location.href = "login.html";
  });
}

const currentPage = document.body.dataset.page;

document.querySelectorAll(".sidebar-link").forEach((link) => {
  link.classList.toggle("active", link.dataset.nav === currentPage);
});

function setStatus(message, type = "") {
  if (!statusElement) return;

  statusElement.textContent = message;
  statusElement.className = "status-message";
  if (type) statusElement.classList.add(type);
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json();
  return { ok: response.ok, data };
}

function renderTableBody(bodyId, rows, columns, emptyMessage) {
  const body = document.getElementById(bodyId);
  if (!body) return;

  body.innerHTML = "";

  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="${columns.length}">${emptyMessage}</td></tr>`;
    return;
  }

  rows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = columns
      .map((column) => `<td>${row[column] ?? "-"}</td>`)
      .join("");
    body.appendChild(tr);
  });
}

function fillSelect(selectId, items, valueKey, labelBuilder, placeholder) {
  const select = document.getElementById(selectId);
  if (!select) return;

  const previousValue = select.value;
  select.innerHTML = "";

  if (placeholder !== undefined) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = placeholder;
    select.appendChild(option);
  }

  items.forEach((item) => {
    const option = document.createElement("option");
    option.value = item[valueKey];
    option.textContent = labelBuilder(item);
    select.appendChild(option);
  });

  if (previousValue) {
    select.value = previousValue;
  }
}

async function submitJson(url, method, payload) {
  const result = await fetchJson(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!result.ok) {
    throw new Error(result.data.message || "Request failed.");
  }

  return result.data;
}

window.AdminApp = {
  admin,
  setStatus,
  fetchJson,
  renderTableBody,
  fillSelect,
  submitJson
};