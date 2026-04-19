const { fetchJson, renderTableBody, setStatus } = window.AdminApp;

async function loadOverview() {
  try {
    const result = await fetchJson("/api/overview-data");
    if (!result.ok) {
      throw new Error(result.data.message || "Unable to load overview.");
    }

    const data = result.data;

    document.getElementById("studentCount").textContent = data.counts.students;
    document.getElementById("facultyCount").textContent = data.counts.faculty;
    document.getElementById("courseCount").textContent = data.counts.courses;
    document.getElementById("departmentCount").textContent = data.counts.departments;

    document.getElementById("studentNote").textContent =
      data.counts.students > 0 ? "Student records available" : "No students inserted yet";
    document.getElementById("facultyNote").textContent =
      data.counts.faculty > 0 ? "Faculty records available" : "No faculty inserted yet";
    document.getElementById("courseNote").textContent =
      data.counts.courses > 0 ? "Courses configured" : "No courses configured yet";
    document.getElementById("departmentNote").textContent =
      data.counts.departments > 0 ? "Departments configured" : "No departments configured yet";

    if (
      data.counts.students === 0 &&
      data.counts.faculty === 0 &&
      data.counts.courses === 0 &&
      data.counts.departments === 0
    ) {
      setStatus("No records were found in the database. Run sample-data.sql in MySQL Workbench, then refresh this page.", "error");
    } else {
      setStatus("Overview loaded successfully.", "success");
    }

    document.getElementById("overviewDbStatus").textContent =
      data.counts.students || data.counts.faculty || data.counts.courses || data.counts.departments
        ? "Database contains active academic records"
        : "Database is connected but currently empty";
    document.getElementById("overviewStudentStatus").textContent =
      data.counts.students > 0
        ? `${data.counts.students} students are available for management`
        : "Insert students to populate overview tables";
    document.getElementById("overviewResultStatus").textContent =
      data.results.length > 0
        ? `${data.results.length} recent result records are visible`
        : "Generate semester results to show GPA entries";
    document.getElementById("overviewActivityStatus").textContent =
      data.activityLogs.length > 0
        ? `${data.activityLogs.length} recent activity entries are visible`
        : "Update marks to create activity log entries";

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
