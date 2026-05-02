const courseApp = window.AdminApp;

function renderCourseRows(courses) {
  const body = document.getElementById("coursesTableBody");
  body.innerHTML = "";

  if (!courses.length) {
    body.innerHTML = '<tr><td colspan="6">No courses found.</td></tr>';
    return;
  }

  courses.forEach((item) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.course_code ?? "-"}</td>
      <td>${item.course_name ?? "-"}</td>
      <td>${item.credits ?? "-"}</td>
      <td>${item.sem_number ?? "-"}</td>
      <td>${item.dept_name || "-"}</td>
      <td><button class="danger-button" data-delete-course="${item.course_id}" type="button">Release</button></td>
    `;
    body.appendChild(tr);
  });
}

async function loadCoursePage() {
  const [lookupsResult, dashboardResult] = await Promise.all([
    courseApp.fetchJson("/api/lookups"),
    courseApp.fetchJson("/api/dashboard-data")
  ]);

  if (!lookupsResult.ok) {
    throw new Error(lookupsResult.data.message || "Unable to load semesters.");
  }

  if (!dashboardResult.ok) {
    throw new Error(dashboardResult.data.message || "Unable to load courses.");
  }

  courseApp.fillSelect(
    "courseSemester",
    lookupsResult.data.semesters,
    "sem_id",
    (item) => `${item.sem_number} - ${item.sem_name}`
  );

  renderCourseRows(dashboardResult.data.courses);
}

document.getElementById("courseForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    await courseApp.submitJson("/api/courses", "POST", {
      courseCode: document.getElementById("courseCode").value.trim(),
      courseName: document.getElementById("courseName").value.trim(),
      credits: document.getElementById("courseCredits").value,
      semId: document.getElementById("courseSemester").value,
      maxMarks: document.getElementById("courseMaxMarks").value
    });
    event.target.reset();
    document.getElementById("courseMaxMarks").value = "100";
    courseApp.setStatus("Course added successfully.", "success");
    await loadCoursePage();
  } catch (error) {
    courseApp.setStatus(error.message, "error");
  }
});

document.getElementById("coursesTableBody").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-delete-course]");
  if (!button) return;

  const ok = window.confirm("Release this course from the syllabus? This deletes the course and its related mappings/marks.");
  if (!ok) return;

  try {
    const result = await courseApp.fetchJson(`/api/courses/${button.dataset.deleteCourse}`, {
      method: "DELETE"
    });
    if (!result.ok) {
      throw new Error(result.data.message || "Unable to release course.");
    }
    courseApp.setStatus("Course released successfully.", "success");
    await loadCoursePage();
  } catch (error) {
    courseApp.setStatus(error.message, "error");
  }
});

loadCoursePage().catch((error) => courseApp.setStatus(error.message, "error"));
