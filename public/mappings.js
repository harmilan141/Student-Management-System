const mappingApp = window.AdminApp;

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

  const { departments, courses, faculty } = lookupsResult.data;
  mappingApp.fillSelect("mapDepartment", departments, "dept_id", (item) => `${item.dept_code} - ${item.dept_name}`);
  mappingApp.fillSelect("assignDepartment", departments, "dept_id", (item) => `${item.dept_code} - ${item.dept_name}`);
  mappingApp.fillSelect("mapCourse", courses, "course_id", (item) => `${item.course_code} - ${item.course_name}`);
  mappingApp.fillSelect("assignCourse", courses, "course_id", (item) => `${item.course_code} - ${item.course_name}`);
  mappingApp.fillSelect("assignFaculty", faculty, "faculty_id", (item) => `${item.faculty_code} - ${item.faculty_name}`);

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

  mappingApp.renderTableBody(
    "facultyCoursesTableBody",
    dashboardResult.data.facultyCourseAssignments.map((item) => ({
      faculty_name: `${item.faculty_code} - ${item.faculty_name}`,
      course_name: `${item.course_code} - ${item.course_name}`,
      dept_name: item.dept_name
    })),
    ["faculty_name", "course_name", "dept_name"],
    "No faculty-course assignments found."
  );
}

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

loadMappingsPage().catch((error) => mappingApp.setStatus(error.message, "error"));
