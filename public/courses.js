const courseApp = window.AdminApp;

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

  courseApp.renderTableBody(
    "coursesTableBody",
    dashboardResult.data.courses.map((item) => ({
      course_code: item.course_code,
      course_name: item.course_name,
      credits: item.credits,
      sem_number: item.sem_number,
      dept_name: item.dept_name || "-"
    })),
    ["course_code", "course_name", "credits", "sem_number", "dept_name"],
    "No courses found."
  );
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

loadCoursePage().catch((error) => courseApp.setStatus(error.message, "error"));
