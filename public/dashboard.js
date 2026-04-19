const { fetchJson, renderTableBody, setStatus } = window.AdminApp;

async function loadOverview() {
  try {
    const result = await fetchJson("/api/dashboard-data");
    if (!result.ok) {
      throw new Error(result.data.message || "Unable to load overview.");
    }

    const data = result.data;

    document.getElementById("studentCount").textContent = data.students.length;
    document.getElementById("facultyCount").textContent = data.faculty.length;
    document.getElementById("courseCount").textContent = data.courses.length;
    document.getElementById("departmentCount").textContent = data.departments.length;

    if (
      data.students.length === 0 &&
      data.faculty.length === 0 &&
      data.courses.length === 0 &&
      data.departments.length === 0
    ) {
      setStatus("No records were found in the database. Run sample-data.sql in MySQL Workbench, then refresh this page.", "error");
    } else {
      setStatus("Overview loaded successfully.", "success");
    }

    renderTableBody(
      "resultsTableBody",
      data.results.slice(0, 8).map((item) => ({
        roll_no: item.roll_no,
        student_name: item.student_name,
        sem_number: item.sem_number,
        gpa: item.gpa,
        pass_fail_status: item.pass_fail_status
      })),
      ["roll_no", "student_name", "sem_number", "gpa", "pass_fail_status"],
      "No results generated yet."
    );

    renderTableBody(
      "activityTableBody",
      data.activityLogs.slice(0, 8).map((item) => ({
        faculty_name: `${item.faculty_code} - ${item.faculty_name}`,
        roll_no: item.roll_no,
        course_code: item.course_code,
        new_marks: item.new_marks ?? "-",
        action_time: new Date(item.action_time).toLocaleString()
      })),
      ["faculty_name", "roll_no", "course_code", "new_marks", "action_time"],
      "No activity logs found."
    );

    renderTableBody(
      "studentsTableBody",
      data.students.slice(0, 10).map((item) => ({
        roll_no: item.roll_no,
        student_name: item.student_name,
        dept_name: item.dept_name,
        sem_number: item.sem_number,
        batch: item.batch
      })),
      ["roll_no", "student_name", "dept_name", "sem_number", "batch"],
      "No students found."
    );
  } catch (error) {
    setStatus(error.message || "Unable to load overview.", "error");
  }
}

loadOverview();
