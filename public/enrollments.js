const enrollApp = window.AdminApp;

let allCourses = [];
let allEnrollments = [];

// ── Filter courses dropdown by semester ───────────────────────
function filterCourseDropdown() {
  const semId = document.getElementById("enrollSemesterFilter").value;
  const filtered = semId
    ? allCourses.filter((c) => String(c.sem_id) === semId)
    : allCourses;

  const select = document.getElementById("enrollCourse");
  select.innerHTML = "";
  if (!filtered.length) {
    select.innerHTML = '<option value="">No courses found</option>';
    return;
  }
  filtered.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c.course_id;
    opt.textContent = `${c.course_code} - ${c.course_name} (Sem ${c.sem_number})`;
    select.appendChild(opt);
  });
}

// ── Load enrolled courses for selected student ────────────────
async function loadStudentEnrollments() {
  const studentId = document.getElementById("enrollStudent").value;
  const tbody = document.getElementById("studentEnrollmentsBody");
  if (!studentId) {
    tbody.innerHTML = '<tr><td colspan="5">Select a student to see their courses.</td></tr>';
    return;
  }

  try {
    const result = await enrollApp.fetchJson(`/api/student-enrollments/${studentId}`);
    tbody.innerHTML = "";

    if (!result.ok || !result.data.enrollments.length) {
      tbody.innerHTML = '<tr><td colspan="5">No courses enrolled yet.</td></tr>';
      return;
    }

    result.data.enrollments.forEach((e) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${e.course_code}</td>
        <td>${e.course_name}</td>
        <td>${e.sem_number}</td>
        <td>${e.faculty_names}</td>
        <td><button class="danger-button" data-remove-enrollment="${e.id}" type="button">Remove</button></td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="5">Could not load enrollments.</td></tr>';
  }
}

// ── Render all enrollments with optional filters ──────────────
function renderAllEnrollments() {
  const studentId = document.getElementById("overviewStudentFilter").value;
  const semId     = document.getElementById("overviewSemFilter").value;

  const filtered = allEnrollments.filter((e) => {
    if (studentId && String(e.student_id) !== studentId) return false;
    if (semId && String(e.sem_id) !== semId) return false;
    return true;
  });

  const tbody = document.getElementById("allEnrollmentsBody");
  tbody.innerHTML = "";

  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="6">No enrollments found.</td></tr>';
    return;
  }

  filtered.forEach((e) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${e.roll_no}</td>
      <td>${e.student_name}</td>
      <td>${e.course_code} - ${e.course_name}</td>
      <td>${e.sem_number}</td>
      <td>${e.faculty_names}</td>
      <td><button class="danger-button" data-remove-enrollment="${e.id}" type="button">Remove</button></td>
    `;
    tbody.appendChild(tr);
  });
}

async function loadEnrollmentsPage() {
  // Load lookups and enrollments separately so a missing table
  // doesn't break the dropdowns
  const lookupsResult = await enrollApp.fetchJson("/api/lookups");
  if (!lookupsResult.ok) {
    throw new Error(lookupsResult.data.message || "Failed to load lookups.");
  }

  const { students, courses, semesters } = lookupsResult.data;
  allCourses = courses;

  // Populate student dropdowns
  enrollApp.fillSelect("enrollStudent", students, "student_id",
    (s) => `${s.roll_no} - ${s.student_name}`);
  enrollApp.fillSelect("overviewStudentFilter", students, "student_id",
    (s) => `${s.roll_no} - ${s.student_name}`, "All Students");

  // Populate semester dropdowns — use sem_id as value for consistent filtering
  enrollApp.fillSelect("enrollSemesterFilter", semesters, "sem_id",
    (s) => `Semester ${s.sem_number} - ${s.sem_name}`, "All Semesters");
  enrollApp.fillSelect("overviewSemFilter", semesters, "sem_id",
    (s) => `Semester ${s.sem_number}`, "All Semesters");

  // Build course dropdown
  filterCourseDropdown();

  // Load student enrollments (may fail if table not yet created)
  try {
    const enrollResult = await enrollApp.fetchJson("/api/student-enrollments");
    if (enrollResult.ok) {
      allEnrollments = enrollResult.data.enrollments;
    } else {
      enrollApp.setStatus(
        "Enrollment table not found. Please run the SQL to create it, then restart the server.",
        "error"
      );
      allEnrollments = [];
    }
  } catch (err) {
    enrollApp.setStatus("Could not connect to enrollment API.", "error");
    allEnrollments = [];
  }

  // Load per-student view for first student
  await loadStudentEnrollments();

  // Render overview table
  renderAllEnrollments();
}

// ── Semester filter changes course list ───────────────────────
document.getElementById("enrollSemesterFilter").addEventListener("change", filterCourseDropdown);

// ── Student selection → reload that student's enrollments ─────
document.getElementById("enrollStudent").addEventListener("change", loadStudentEnrollments);

// ── Enroll form submit ────────────────────────────────────────
document.getElementById("enrollForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const studentId = document.getElementById("enrollStudent").value;
  const courseId  = document.getElementById("enrollCourse").value;

  if (!studentId || !courseId) {
    enrollApp.setStatus("Please select both a student and a course.", "error");
    return;
  }

  try {
    await enrollApp.submitJson("/api/student-enrollments", "POST", { studentId, courseId });
    enrollApp.setStatus("Student enrolled in course successfully.", "success");
    await loadEnrollmentsPage();
  } catch (error) {
    enrollApp.setStatus(error.message, "error");
  }
});

// ── Overview filter button ────────────────────────────────────
document.getElementById("overviewFilterBtn").addEventListener("click", renderAllEnrollments);

// ── Remove enrollment handler ─────────────────────────────────
async function handleRemoveEnrollment(enrollmentId) {
  if (!window.confirm("Remove this enrollment?")) return;
  try {
    const result = await enrollApp.fetchJson(`/api/student-enrollments/${enrollmentId}`, { method: "DELETE" });
    if (!result.ok) throw new Error(result.data.message || "Failed to remove enrollment.");
    enrollApp.setStatus("Enrollment removed.", "success");
    await loadEnrollmentsPage();
  } catch (error) {
    enrollApp.setStatus(error.message, "error");
  }
}

document.getElementById("studentEnrollmentsBody").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-remove-enrollment]");
  if (btn) handleRemoveEnrollment(btn.dataset.removeEnrollment);
});

document.getElementById("allEnrollmentsBody").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-remove-enrollment]");
  if (btn) handleRemoveEnrollment(btn.dataset.removeEnrollment);
});

loadEnrollmentsPage().catch((error) => enrollApp.setStatus(error.message, "error"));
