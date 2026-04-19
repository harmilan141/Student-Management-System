const savedUser = localStorage.getItem("smsUser");

if (!savedUser) {
  window.location.href = "index.html";
}

const admin = savedUser ? JSON.parse(savedUser) : null;
if (admin && admin.role !== "admin") {
  window.location.href = "user-dashboard.html";
}

const dashboardStatus = document.getElementById("dashboardStatus");
let lookups = {
  departments: [],
  semesters: [],
  courses: [],
  faculty: []
};

document.getElementById("dashboardName").textContent = admin ? admin.full_name : "Administrator";
document.getElementById("dashboardEmail").textContent = admin ? admin.email : "-";

function setDashboardStatus(message, type = "") {
  dashboardStatus.textContent = message;
  dashboardStatus.className = "status-message";
  if (type) {
    dashboardStatus.classList.add(type);
  }
}

function fillSelect(selectId, items, valueKey, labelBuilder, placeholder) {
  const select = document.getElementById(selectId);
  select.innerHTML = "";

  if (placeholder) {
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
}

function renderTableBody(bodyId, rows, columns, emptyMessage) {
  const body = document.getElementById(bodyId);
  body.innerHTML = "";

  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="${columns.length}">${emptyMessage}</td></tr>`;
    return;
  }

  rows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = columns.map((column) => `<td>${row[column] ?? "-"}</td>`).join("");
    body.appendChild(tr);
  });
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json();
  return { ok: response.ok, data };
}

async function loadLookups() {
  const result = await fetchJson("/api/lookups");
  if (!result.ok) {
    throw new Error(result.data.message || "Unable to load lookup data.");
  }

  lookups = result.data;

  fillSelect("departmentFilter", lookups.departments, "dept_id", (d) => `${d.dept_code} - ${d.dept_name}`, "All Departments");
  fillSelect("studentDepartment", lookups.departments, "dept_id", (d) => `${d.dept_code} - ${d.dept_name}`);
  fillSelect("facultyDepartment", lookups.departments, "dept_id", (d) => `${d.dept_code} - ${d.dept_name}`);
  fillSelect("mapDepartment", lookups.departments, "dept_id", (d) => `${d.dept_code} - ${d.dept_name}`);
  fillSelect("assignDepartment", lookups.departments, "dept_id", (d) => `${d.dept_code} - ${d.dept_name}`);
  fillSelect("courseSemester", lookups.semesters, "sem_id", (s) => `${s.sem_number} - ${s.sem_name}`);
  fillSelect("studentSemester", lookups.semesters, "sem_id", (s) => `${s.sem_number} - ${s.sem_name}`);
  fillSelect("resultSemester", lookups.semesters, "sem_id", (s) => `${s.sem_number} - ${s.sem_name}`);
  fillSelect("mapCourse", lookups.courses, "course_id", (c) => `${c.course_code} - ${c.course_name}`);
  fillSelect("assignCourse", lookups.courses, "course_id", (c) => `${c.course_code} - ${c.course_name}`);
  fillSelect("marksCourse", lookups.courses, "course_id", (c) => `${c.course_code} - ${c.course_name}`);
  fillSelect("assignFaculty", lookups.faculty, "faculty_id", (f) => `${f.faculty_code} - ${f.faculty_name}`);
  fillSelect("marksFaculty", lookups.faculty, "faculty_id", (f) => `${f.faculty_code} - ${f.faculty_name}`);
}

function buildDashboardUrl() {
  const params = new URLSearchParams();
  const search = document.getElementById("studentSearch").value.trim();
  const departmentId = document.getElementById("departmentFilter").value;

  if (search) {
    params.set("search", search);
  }
  if (departmentId) {
    params.set("departmentId", departmentId);
  }

  const query = params.toString();
  return query ? `/api/dashboard-data?${query}` : "/api/dashboard-data";
}

async function loadDashboardData() {
  try {
    const result = await fetchJson(buildDashboardUrl());
    if (!result.ok) {
      setDashboardStatus(result.data.message || "Unable to load dashboard data.", "error");
      return;
    }

    const data = result.data;

    renderTableBody(
      "studentsTableBody",
      data.students.map((student) => ({
        student_id: student.student_id,
        roll_no: student.roll_no,
        student_name: student.student_name,
        dept_name: student.dept_name,
        sem_number: student.sem_number,
        assigned_faculty: student.assigned_faculty || "Not assigned"
      })),
      ["student_id", "roll_no", "student_name", "dept_name", "sem_number", "assigned_faculty"],
      "No students found."
    );

    renderTableBody(
      "facultyTableBody",
      data.faculty,
      ["faculty_id", "faculty_code", "faculty_name", "designation", "dept_name"],
      "No faculty found."
    );

    renderTableBody(
      "coursesTableBody",
      data.courses.map((course) => ({
        course_code: course.course_code,
        course_name: course.course_name,
        credits: course.credits,
        sem_number: course.sem_number,
        dept_name: course.dept_name || "-"
      })),
      ["course_code", "course_name", "credits", "sem_number", "dept_name"],
      "No courses found."
    );

    renderTableBody(
      "departmentCoursesTableBody",
      data.departmentCourseMappings.map((item) => ({
        dept_name: `${item.dept_code} - ${item.dept_name}`,
        course_code: item.course_code,
        course_name: item.course_name
      })),
      ["dept_name", "course_code", "course_name"],
      "No department-course mappings found."
    );

    renderTableBody(
      "facultyCoursesTableBody",
      data.facultyCourseAssignments.map((item) => ({
        faculty_name: `${item.faculty_code} - ${item.faculty_name}`,
        course_name: `${item.course_code} - ${item.course_name}`,
        dept_name: item.dept_name
      })),
      ["faculty_name", "course_name", "dept_name"],
      "No faculty-course assignments found."
    );

    renderTableBody(
      "marksTableBody",
      data.marks.map((item) => ({
        marks_id: item.marks_id,
        roll_no: item.roll_no,
        course_code: `${item.course_code} - ${item.course_name}`,
        faculty_code: `${item.faculty_code} - ${item.faculty_name}`,
        marks_obtained: item.marks_obtained,
        grade: `${item.grade} (${item.grade_point})`
      })),
      ["marks_id", "roll_no", "course_code", "faculty_code", "marks_obtained", "grade"],
      "No marks found."
    );

    renderTableBody(
      "resultsTableBody",
      data.results.map((item) => ({
        roll_no: item.roll_no,
        sem_number: item.sem_number,
        gpa: item.gpa,
        pass_fail_status: item.pass_fail_status
      })),
      ["roll_no", "sem_number", "gpa", "pass_fail_status"],
      "No results found."
    );

    renderTableBody(
      "activityTableBody",
      data.activityLogs.map((item) => ({
        faculty_name: `${item.faculty_code} - ${item.faculty_name}`,
        roll_no: item.roll_no,
        course_code: item.course_code,
        old_marks: item.old_marks ?? "-",
        new_marks: item.new_marks ?? "-"
      })),
      ["faculty_name", "roll_no", "course_code", "old_marks", "new_marks"],
      "No activity logs found."
    );
  } catch (error) {
    setDashboardStatus(error.message || "Server error while loading dashboard data.", "error");
  }
}

async function submitForm(url, method, payload) {
  const result = await fetchJson(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!result.ok) {
    throw new Error(result.data.message || "Request failed.");
  }
}

document.getElementById("departmentForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const departmentId = document.getElementById("departmentId").value;
  const payload = {
    deptCode: document.getElementById("deptCode").value.trim(),
    deptName: document.getElementById("deptName").value.trim()
  };

  try {
    if (departmentId) {
      await submitForm(`/api/departments/${departmentId}`, "PUT", payload);
      setDashboardStatus("Department updated successfully.", "success");
    } else {
      await submitForm("/api/departments", "POST", payload);
      setDashboardStatus("Department added successfully.", "success");
    }
    event.target.reset();
    document.getElementById("departmentId").value = "";
    await loadLookups();
    await loadDashboardData();
  } catch (error) {
    setDashboardStatus(error.message, "error");
  }
});

document.getElementById("semesterForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = {
    semNumber: document.getElementById("semNumber").value,
    semName: document.getElementById("semName").value.trim()
  };

  try {
    await submitForm("/api/semesters", "POST", payload);
    event.target.reset();
    setDashboardStatus("Semester added successfully.", "success");
    await loadLookups();
  } catch (error) {
    setDashboardStatus(error.message, "error");
  }
});

document.getElementById("courseForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = {
    courseCode: document.getElementById("courseCode").value.trim(),
    courseName: document.getElementById("courseName").value.trim(),
    credits: document.getElementById("courseCredits").value,
    semId: document.getElementById("courseSemester").value,
    maxMarks: document.getElementById("courseMaxMarks").value
  };

  try {
    await submitForm("/api/courses", "POST", payload);
    event.target.reset();
    setDashboardStatus("Course added successfully.", "success");
    await loadLookups();
    await loadDashboardData();
  } catch (error) {
    setDashboardStatus(error.message, "error");
  }
});

document.getElementById("studentForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const studentRecordId = document.getElementById("studentId").value;
  const payload = {
    rollNo: document.getElementById("studentRollNo").value.trim(),
    universityRollNo: document.getElementById("studentUniversityRollNo").value.trim(),
    studentName: document.getElementById("studentName").value.trim(),
    fatherName: document.getElementById("studentFatherName").value.trim(),
    motherName: document.getElementById("studentMotherName").value.trim(),
    gender: document.getElementById("studentGender").value,
    dob: document.getElementById("studentDob").value,
    phoneNo: document.getElementById("studentPhone").value.trim(),
    parentPhone: document.getElementById("studentParentPhone").value.trim(),
    email: document.getElementById("studentEmail").value.trim(),
    address: document.getElementById("studentAddress").value.trim(),
    batch: document.getElementById("studentBatch").value.trim(),
    classBatch: document.getElementById("studentClassBatch").value.trim(),
    deptId: document.getElementById("studentDepartment").value,
    semId: document.getElementById("studentSemester").value,
    password: document.getElementById("studentPassword").value
  };

  try {
    if (studentRecordId) {
      await submitForm(`/api/students/${studentRecordId}`, "PUT", payload);
      setDashboardStatus("Student updated successfully.", "success");
    } else {
      await submitForm("/api/students", "POST", payload);
      setDashboardStatus("Student added successfully.", "success");
    }
    event.target.reset();
    document.getElementById("studentId").value = "";
    await loadDashboardData();
  } catch (error) {
    setDashboardStatus(error.message, "error");
  }
});

document.getElementById("facultyForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const facultyRecordId = document.getElementById("facultyId").value;
  const payload = {
    empId: document.getElementById("facultyEmpId").value.trim(),
    facultyCode: document.getElementById("facultyCode").value.trim(),
    facultyName: document.getElementById("facultyName").value.trim(),
    gender: document.getElementById("facultyGender").value,
    dob: document.getElementById("facultyDob").value,
    qualification: document.getElementById("facultyQualification").value.trim(),
    specialization: document.getElementById("facultySpecialization").value.trim(),
    designation: document.getElementById("facultyDesignation").value,
    phoneNo: document.getElementById("facultyPhone").value.trim(),
    email: document.getElementById("facultyEmail").value.trim(),
    deptId: document.getElementById("facultyDepartment").value,
    password: document.getElementById("facultyPassword").value
  };

  try {
    if (facultyRecordId) {
      await submitForm(`/api/faculty/${facultyRecordId}`, "PUT", payload);
      setDashboardStatus("Faculty updated successfully.", "success");
    } else {
      await submitForm("/api/faculty", "POST", payload);
      setDashboardStatus("Faculty added successfully.", "success");
    }
    event.target.reset();
    document.getElementById("facultyId").value = "";
    await loadLookups();
    await loadDashboardData();
  } catch (error) {
    setDashboardStatus(error.message, "error");
  }
});

document.getElementById("departmentCourseForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await submitForm("/api/department-course-mappings", "POST", {
      deptId: document.getElementById("mapDepartment").value,
      courseId: document.getElementById("mapCourse").value
    });
    event.target.reset();
    setDashboardStatus("Department-course mapping saved.", "success");
    await loadDashboardData();
  } catch (error) {
    setDashboardStatus(error.message, "error");
  }
});

document.getElementById("facultyCourseForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await submitForm("/api/faculty-course-assignments", "POST", {
      facultyId: document.getElementById("assignFaculty").value,
      courseId: document.getElementById("assignCourse").value,
      deptId: document.getElementById("assignDepartment").value
    });
    event.target.reset();
    setDashboardStatus("Faculty-course assignment saved.", "success");
    await loadDashboardData();
  } catch (error) {
    setDashboardStatus(error.message, "error");
  }
});

document.getElementById("marksForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const marksId = document.getElementById("marksId").value.trim();
  const payload = {
    rollNo: document.getElementById("marksRollNo").value.trim(),
    courseId: document.getElementById("marksCourse").value,
    facultyId: document.getElementById("marksFaculty").value,
    marksObtained: document.getElementById("marksObtained").value
  };

  try {
    if (marksId) {
      await submitForm(`/api/marks/${marksId}`, "PUT", {
        marksObtained: payload.marksObtained,
        facultyId: payload.facultyId
      });
      setDashboardStatus("Marks updated successfully.", "success");
    } else {
      await submitForm("/api/marks", "POST", payload);
      setDashboardStatus("Marks entered successfully.", "success");
    }
    event.target.reset();
    await loadDashboardData();
  } catch (error) {
    setDashboardStatus(error.message, "error");
  }
});

document.getElementById("resultForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await submitForm("/api/results/generate", "POST", {
      rollNo: document.getElementById("resultRollNo").value.trim(),
      semId: document.getElementById("resultSemester").value
    });
    event.target.reset();
    setDashboardStatus("Semester result generated successfully.", "success");
    await loadDashboardData();
  } catch (error) {
    setDashboardStatus(error.message, "error");
  }
});

document.getElementById("deleteStudentForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const studentId = document.getElementById("deleteStudentId").value;

  try {
    const result = await fetchJson(`/api/students/${studentId}`, { method: "DELETE" });
    if (!result.ok) {
      throw new Error(result.data.message || "Unable to delete student.");
    }
    event.target.reset();
    setDashboardStatus("Student deleted successfully.", "success");
    await loadDashboardData();
  } catch (error) {
    setDashboardStatus(error.message, "error");
  }
});

document.getElementById("searchButton").addEventListener("click", loadDashboardData);
document.getElementById("refreshButton").addEventListener("click", async () => {
  document.getElementById("studentSearch").value = "";
  document.getElementById("departmentFilter").value = "";
  await loadDashboardData();
});

document.getElementById("studentResetButton").addEventListener("click", () => {
  document.getElementById("studentForm").reset();
  document.getElementById("studentId").value = "";
});

document.getElementById("facultyResetButton").addEventListener("click", () => {
  document.getElementById("facultyForm").reset();
  document.getElementById("facultyId").value = "";
});

document.getElementById("logoutButton").addEventListener("click", () => {
  localStorage.removeItem("smsUser");
  window.location.href = "index.html";
});

(async function init() {
  try {
    await loadLookups();
    await loadDashboardData();
  } catch (error) {
    setDashboardStatus(error.message || "Unable to initialize dashboard.", "error");
  }
})();
