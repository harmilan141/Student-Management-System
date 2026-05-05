const mappingApp = window.AdminApp;

function renderFacultyAssignmentRows(assignments) {
  const body = document.getElementById("facultyCoursesTableBody");
  body.innerHTML = "";

  if (!assignments.length) {
    body.innerHTML = '<tr><td colspan="4">No faculty-course assignments found.</td></tr>';
    return;
  }

  assignments.forEach((item) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.faculty_code ?? "-"} - ${item.faculty_name ?? "-"}</td>
      <td>${item.course_code ?? "-"} - ${item.course_name ?? "-"}</td>
      <td>${item.dept_name ?? "-"}</td>
      <td><button class="danger-button" data-release-assignment="${item.mapping_id}" type="button">Release</button></td>
    `;
    body.appendChild(tr);
  });
}

// ── Render Faculty-Student advisor table ──────────────────────
function renderFacultyStudentRows(assignments) {
  const body = document.getElementById("facultyStudentTableBody");
  body.innerHTML = "";

  if (!assignments || !assignments.length) {
    body.innerHTML = '<tr><td colspan="4">No advisor assignments found.</td></tr>';
    return;
  }

  assignments.forEach((item) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.student_name ?? "-"}</td>
      <td>${item.roll_no ?? "-"}</td>
      <td>${item.faculty_name ?? "-"} (${item.faculty_code ?? "-"})</td>
      <td><button class="danger-button" data-remove-advisor="${item.id}" type="button">Remove</button></td>
    `;
    body.appendChild(tr);
  });
}

async function loadMappingsPage() {
  const [lookupsResult, dashboardResult] = await Promise.all([
    mappingApp.fetchJson("/api/lookups"),
    mappingApp.fetchJson("/api/dashboard-data")
  ]);

  if (!lookupsResult.ok) {
    throw new Error(lookupsResult.data.message || "Unable to load mapping lookups.");
  }
  if (!dashboardResult.ok) {
    throw new Error(dashboardResult.data.message || "Unable to load mapping data.");
  }

  const { departments, courses, faculty, students } = lookupsResult.data;
  mappingApp.fillSelect("mapDepartment", departments, "dept_id", (item) => `${item.dept_code} - ${item.dept_name}`);
  mappingApp.fillSelect("assignDepartment", departments, "dept_id", (item) => `${item.dept_code} - ${item.dept_name}`);
  mappingApp.fillSelect("mapCourse", courses, "course_id", (item) => `${item.course_code} - ${item.course_name}`);
  mappingApp.fillSelect("assignCourse", courses, "course_id", (item) => `${item.course_code} - ${item.course_name}`);
  mappingApp.fillSelect("assignFaculty", faculty, "faculty_id", (item) => `${item.faculty_code} - ${item.faculty_name}`);

  // Faculty-Student advisor dropdowns
  mappingApp.fillSelect("advisorFaculty", faculty, "faculty_id", (item) => `${item.faculty_code} - ${item.faculty_name}`);
  mappingApp.fillSelect("advisorStudent", students, "student_id", (item) => `${item.roll_no} - ${item.student_name}`);

  mappingApp.renderTableBody(
    "departmentCoursesTableBody",
    dashboardResult.data.departmentCourseMappings.map((item) => ({
      dept_name: `${item.dept_code} - ${item.dept_name}`,
      course_code: item.course_code,
      course_name: item.course_name
    })),
    ["dept_name", "course_code", "course_name"],
    "No department-course mappings found."
  );

  renderFacultyAssignmentRows(dashboardResult.data.facultyCourseAssignments);

  // Load faculty-student advisor assignments
  const advisorResult = await mappingApp.fetchJson("/api/faculty-student-mappings");
  renderFacultyStudentRows(advisorResult.ok ? advisorResult.data.mappings : []);
}

// ── Department-course mapping form ────────────────────────────
document.getElementById("departmentCourseForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await mappingApp.submitJson("/api/department-course-mappings", "POST", {
      deptId: document.getElementById("mapDepartment").value,
      courseId: document.getElementById("mapCourse").value
    });
    event.target.reset();
    mappingApp.setStatus("Department-course mapping saved.", "success");
    await loadMappingsPage();
  } catch (error) {
    mappingApp.setStatus(error.message, "error");
  }
});

// ── Faculty-course assignment form ────────────────────────────
document.getElementById("facultyCourseForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await mappingApp.submitJson("/api/faculty-course-assignments", "POST", {
      facultyId: document.getElementById("assignFaculty").value,
      courseId: document.getElementById("assignCourse").value,
      deptId: document.getElementById("assignDepartment").value
    });
    event.target.reset();
    mappingApp.setStatus("Faculty-course assignment saved.", "success");
    await loadMappingsPage();
  } catch (error) {
    mappingApp.setStatus(error.message, "error");
  }
});

// ── Faculty-student advisor form (NEW) ────────────────────────
document.getElementById("facultyStudentForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await mappingApp.submitJson("/api/faculty-student-mappings", "POST", {
      facultyId: document.getElementById("advisorFaculty").value,
      studentId: document.getElementById("advisorStudent").value
    });
    event.target.reset();
    mappingApp.setStatus("Faculty-student advisor assignment saved.", "success");
    await loadMappingsPage();
  } catch (error) {
    mappingApp.setStatus(error.message, "error");
  }
});

// ── Release faculty-course assignment ─────────────────────────
document.getElementById("facultyCoursesTableBody").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-release-assignment]");
  if (!button) return;

  const ok = window.confirm("Release this faculty from the selected course?");
  if (!ok) return;

  try {
    const result = await mappingApp.fetchJson(`/api/mappings/${button.dataset.releaseAssignment}`, {
      method: "DELETE"
    });
    if (!result.ok) throw new Error(result.data.message || "Unable to release assignment.");
    mappingApp.setStatus("Faculty released from course.", "success");
    await loadMappingsPage();
  } catch (error) {
    mappingApp.setStatus(error.message, "error");
  }
});

// ── Remove faculty-student advisor assignment (NEW) ───────────
document.getElementById("facultyStudentTableBody").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-remove-advisor]");
  if (!button) return;

  const ok = window.confirm("Remove this advisor assignment?");
  if (!ok) return;

  try {
    const result = await mappingApp.fetchJson(`/api/faculty-student-mappings/${button.dataset.removeAdvisor}`, {
      method: "DELETE"
    });
    if (!result.ok) throw new Error(result.data.message || "Unable to remove advisor.");
    mappingApp.setStatus("Advisor assignment removed.", "success");
    await loadMappingsPage();
  } catch (error) {
    mappingApp.setStatus(error.message, "error");
  }
});

loadMappingsPage().catch((error) => mappingApp.setStatus(error.message, "error"));
