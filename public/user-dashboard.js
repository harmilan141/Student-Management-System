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

function escapeHtml(value) {
  return String(value ?? "-")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function setUserStatus(message, type = "") {
  if (!userStatus) return;

  userStatus.textContent = message;
  userStatus.className = "status-message";
  if (type) userStatus.classList.add(type);
}

function renderDetail(label, value) {
  return `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || "-")}</strong></div>`;
}

function renderSimpleTable(title, headers, rows) {
  if (!rows.length) {
    return `
      <section class="card">
        <div class="panel-header"><h2>${title}</h2></div>
        <p class="subtitle">No records found.</p>
      </section>`;
  }

  const head = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("");
  const body = rows.map((row) =>
    `<tr>${row.map((cell) => `<td>${escapeHtml(cell ?? "-")}</td>`).join("")}</tr>`
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

function renderSummaryCards(items) {
  return `
    <section class="dashboard-grid four-column">
      ${items.map((item) => `
        <article class="card stat-card ${item.variant || ""}">
          <span>${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(item.value)}</strong>
          <p class="stat-note">${escapeHtml(item.note || "")}</p>
        </article>
      `).join("")}
    </section>`;
}

function average(values) {
  const numeric = values.map(Number).filter((value) => Number.isFinite(value));
  if (!numeric.length) return "-";
  return (numeric.reduce((sum, value) => sum + value, 0) / numeric.length).toFixed(2);
}

function gradeForMarks(marks) {
  const score = Number(marks);
  if (!Number.isFinite(score)) return "-";
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  if (score >= 50) return "D";
  return "F";
}

function renderFacultyMarksEditor(data) {
  const studentOptions = data.students.map((student) =>
    `<option value="${escapeHtml(student.roll_no)}">${escapeHtml(student.roll_no)} - ${escapeHtml(student.student_name)}</option>`
  ).join("");

  const courseOptions = data.courses.map((course) =>
    `<option value="${escapeHtml(course.course_id)}">${escapeHtml(course.course_code)} - ${escapeHtml(course.course_name)}</option>`
  ).join("");

  return `
    <section class="card">
      <div class="panel-header">
        <h2>Edit Student Marks</h2>
        <p class="subtitle">Add or update marks for students in your assigned course semesters.</p>
      </div>
      <form class="stack-form" id="facultyMarksForm">
        <label for="facultyMarkStudent">Student</label>
        <select id="facultyMarkStudent" required>
          <option value="">Select student</option>
          ${studentOptions}
        </select>

        <label for="facultyMarkCourse">Course</label>
        <select id="facultyMarkCourse" required>
          <option value="">Select course</option>
          ${courseOptions}
        </select>

        <label for="facultyMarkValue">Marks</label>
        <input id="facultyMarkValue" type="number" min="0" max="100" step="0.01" placeholder="85" required>

        <button class="login-button" type="submit">Save Marks</button>
      </form>
    </section>`;
}

function renderRelatedStudentsTable(students) {
  if (!students.length) {
    return `
      <section class="card">
        <div class="panel-header"><h2>Related Students</h2></div>
        <p class="subtitle">No records found.</p>
      </section>`;
  }

  const rows = students.map((student) => `
    <tr>
      <td>${escapeHtml(student.roll_no)}</td>
      <td>${escapeHtml(student.student_name)}</td>
      <td>${escapeHtml(student.dept_name)}</td>
      <td>${escapeHtml(student.sem_number)}</td>
      <td>${escapeHtml(student.batch)}</td>
      <td><button class="danger-button" data-remove-student="${escapeHtml(student.roll_no)}" type="button">Delete</button></td>
    </tr>
  `).join("");

  return `
    <section class="card">
      <div class="panel-header"><h2>Related Students</h2></div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Roll No</th>
              <th>Name</th>
              <th>Department</th>
              <th>Sem</th>
              <th>Batch</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>`;
}

function attachFacultyMarksForm() {
  const form = document.getElementById("facultyMarksForm");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      const response = await fetch(`/api/faculty/${encodeURIComponent(user.user_id)}/marks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rollNo: document.getElementById("facultyMarkStudent").value,
          courseId: document.getElementById("facultyMarkCourse").value,
          marksObtained: document.getElementById("facultyMarkValue").value
        })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Failed to save marks.");
      }

      setUserStatus(result.message || "Marks saved.", "success");
      form.reset();
      await loadUserProfile();
    } catch (error) {
      setUserStatus(error.message || "Failed to save marks.", "error");
    }
  });
}

function attachFacultyStudentRemoval() {
  document.querySelectorAll("[data-remove-student]").forEach((button) => {
    button.addEventListener("click", async () => {
      const rollNo = button.dataset.removeStudent;
      const ok = window.confirm(`Delete student ${rollNo}? This removes the student record and related marks/results.`);
      if (!ok) return;

      try {
        const response = await fetch(`/api/faculty/${encodeURIComponent(user.user_id)}/students/${encodeURIComponent(rollNo)}`, {
          method: "DELETE"
        });
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.message || "Failed to delete student.");
        }

        setUserStatus(result.message || "Student deleted.", "success");
        await loadUserProfile();
      } catch (error) {
        setUserStatus(error.message || "Failed to delete student.", "error");
      }
    });
  });
}

async function loadUserProfile() {
  if (!user) return;

  document.getElementById("userName").textContent = user.full_name;
  document.getElementById("userEmail").textContent = user.email;
  document.getElementById("sidebarUserName").textContent = user.full_name;
  document.getElementById("userRoleLabel").textContent = user.role === "student" ? "Student Portal" : "Faculty Portal";
  document.getElementById("userDashboardHeading").textContent = user.role === "student" ? "Student Dashboard" : "Faculty Dashboard";
  document.getElementById("userDashboardIntro").textContent =
    user.role === "student"
      ? "Your profile, marks, grades, and semester results are shown below."
      : "Your profile, assigned courses, and students are shown below.";

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
      userDetails.innerHTML = [
        renderDetail("Roll No", data.student.roll_no),
        renderDetail("Name", data.student.student_name),
        renderDetail("Email", data.student.email),
        renderDetail("Department", data.student.dept_name),
        renderDetail("Semester", data.student.sem_number),
        renderDetail("Batch", data.student.batch)
      ].join("");

      const marksRows = data.marks.map((mark) => [
        `${mark.course_code} - ${mark.course_name}`,
        mark.marks,
        mark.max_marks,
        Number.isFinite(Number(mark.percentage))
          ? `${Number(mark.percentage).toFixed(2)}%`
          : Number.isFinite(Number(mark.marks)) && Number.isFinite(Number(mark.max_marks)) && Number(mark.max_marks) > 0
            ? `${((Number(mark.marks) / Number(mark.max_marks)) * 100).toFixed(2)}%`
            : "-",
        mark.grade || gradeForMarks(mark.marks)
      ]);

      const resultRows = data.results.map((result) => [
        result.sem_number,
        result.gpa,
        result.pass_fail_status || "-"
      ]);

      content.innerHTML =
        renderSummaryCards([
          { label: "Courses", value: data.marks.length, note: "Marks entries" },
          { label: "Average Marks", value: average(data.marks.map((mark) => mark.marks)), note: "Across listed courses", variant: "variant-mint" },
          { label: "Average GPA", value: average(data.results.map((result) => result.gpa)), note: "Generated semesters", variant: "variant-blue" },
          { label: "Current Semester", value: data.student.sem_number, note: data.student.dept_name, variant: "variant-warn" }
        ]) +
        `<section class="table-grid two-column">` +
        renderSimpleTable("Marks and Grades", ["Course", "Marks", "Max", "Percent", "Grade"], marksRows) +
        renderSimpleTable("Semester Results", ["Sem", "GPA", "Status"], resultRows) +
        `</section>`;

    } else {
      userDetails.innerHTML = [
        renderDetail("Faculty Code", data.faculty.faculty_code),
        renderDetail("Name", data.faculty.faculty_name),
        renderDetail("Email", data.faculty.email),
        renderDetail("Department", data.faculty.dept_name)
      ].join("");

      content.innerHTML =
        renderSummaryCards([
          { label: "Courses", value: data.courses.length, note: "Assigned courses" },
          { label: "Students", value: data.students.length, note: "In assigned course semesters", variant: "variant-mint" }
        ]) +
        renderFacultyMarksEditor(data) +
        `<section class="table-grid two-column">` +
        renderSimpleTable(
          "Assigned Courses",
          ["Code", "Course", "Department", "Sem"],
          data.courses.map((course) => [course.course_code, course.course_name, course.dept_name, course.sem_number])
        ) +
        renderRelatedStudentsTable(data.students) +
        `</section>` +
        renderSimpleTable(
          "Student Marks",
          ["Roll No", "Student", "Course", "Marks", "Max", "Grade"],
          (data.studentMarks || []).map((mark) => [
            mark.roll_no,
            mark.student_name,
            `${mark.course_code} - ${mark.course_name}`,
            mark.marks ?? "Not entered",
            mark.max_marks ?? 100,
            mark.marks === null || mark.marks === undefined ? "-" : gradeForMarks(mark.marks)
          ])
        );

      attachFacultyMarksForm();
      attachFacultyStudentRemoval();
    }

  } catch (error) {
    setUserStatus(error.message || "Server error", "error");
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
