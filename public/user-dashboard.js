const savedUser = localStorage.getItem("smsUser");

if (!savedUser) {
  window.location.href = "login.html";
  throw new Error("No session");
}

let user = null;

try {
  user = JSON.parse(savedUser);
} catch (e) {
  localStorage.removeItem("smsUser");
  window.location.href = "login.html";
  throw new Error("Invalid session data");
}

if (user && user.role === "admin") {
  window.location.href = "dashboard.html";
  throw new Error("Redirecting admin");
}

const userStatus = document.getElementById("userStatus");
const userDetails = document.getElementById("userDetails");

function setUserStatus(message, type = "") {
  if (!userStatus) return;

  userStatus.textContent = message;
  userStatus.className = "status-message";
  if (type) userStatus.classList.add(type);
}

function renderDetail(label, value) {
  return `<div><span>${label}</span><strong>${value || "-"}</strong></div>`;
}

function renderSimpleTable(title, headers, rows) {
  if (!rows.length) {
    return `
      <section class="card">
        <div class="panel-header"><h2>${title}</h2></div>
        <p class="subtitle">No records found.</p>
      </section>`;
  }

  const head = headers.map((h) => `<th>${h}</th>`).join("");
  const body = rows.map((row) =>
    `<tr>${row.map((cell) => `<td>${cell ?? "-"}</td>`).join("")}</tr>`
  ).join("");

  return `
    <section class="card">
      <div class="panel-header"><h2>${title}</h2></div>
      <div class="table-wrap">
        <table>
          <thead><tr>${head}</tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    </section>`;
}

function renderCgpaForm(students) {
  const options = students.map((s) =>
    `<option value="${s.roll_no}">${s.roll_no} - ${s.student_name}</option>`
  ).join("");

  return `
    <section class="card">
      <div class="panel-header">
        <h2>Student CGPA Management</h2>
        <p class="subtitle">Insert or edit cumulative GPA.</p>
      </div>
      <form class="stack-form" id="facultyCgpaForm">
        <select id="cgpaStudentRoll" required>
          <option value="">Select student</option>
          ${options}
        </select>
        <input id="cgpaValue" type="number" min="0" max="10" step="0.01" required>
        <input id="cgpaRemarks" type="text">
        <button class="login-button" type="submit">Save CGPA</button>
      </form>
    </section>`;
}

async function loadUserProfile() {
  if (!user) return;

  document.getElementById("userName").textContent = user.full_name;
  document.getElementById("userEmail").textContent = user.email;

  try {
    const endpoint =
      user.role === "student"
        ? `/api/student/${user.user_id}`
        : `/api/faculty/${user.user_id}`;

    const response = await fetch(endpoint);
    const data = await response.json();

    if (!response.ok) {
      setUserStatus(data.message || "Error loading profile", "error");
      return;
    }

    const content = document.getElementById("userContent");

    if (user.role === "student") {
      userDetails.innerHTML = renderDetail("Roll No", data.student.roll_no);

      content.innerHTML = renderSimpleTable(
        "Results",
        ["Sem", "GPA"],
        data.results.map(r => [r.sem_number, r.gpa])
      );

    } else {
      userDetails.innerHTML = renderDetail("Faculty", data.faculty.faculty_code);

      content.innerHTML =
        renderCgpaForm(data.students || []);
    }

  } catch {
    setUserStatus("Server error", "error");
  }
}

const logoutBtn = document.getElementById("userLogoutButton");

if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("smsUser");
    window.location.href = "login.html";
  });
}

loadUserProfile();