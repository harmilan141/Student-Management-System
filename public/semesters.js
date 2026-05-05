const studentApp = window.AdminApp;

function buildStudentsUrl() {
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

async function loadStudentPage() {
  const [lookupsResult, dashboardResult] = await Promise.all([
    studentApp.fetchJson("/api/lookups"),
    studentApp.fetchJson(buildStudentsUrl())
  ]);

  if (!lookupsResult.ok) {
    throw new Error(lookupsResult.data.message || "Unable to load student form data.");
  }

  if (!dashboardResult.ok) {
    throw new Error(dashboardResult.data.message || "Unable to load students.");
  }

  const { departments, semesters } = lookupsResult.data;
  studentApp.fillSelect("departmentFilter", departments, "dept_id", (item) => `${item.dept_code} - ${item.dept_name}`, "All Departments");
  studentApp.fillSelect("studentDepartment", departments, "dept_id", (item) => `${item.dept_code} - ${item.dept_name}`);
  studentApp.fillSelect("studentSemester", semesters, "sem_id", (item) => `${item.sem_number} - ${item.sem_name}`);

  studentApp.renderTableBody(
    "studentsTableBody",
    dashboardResult.data.students.map((item) => ({
      student_id: item.student_id,
      roll_no: item.roll_no,
      student_name: item.student_name,
      dept_name: item.dept_name,
      sem_number: item.sem_number,
      assigned_faculty: item.assigned_faculty || "Not assigned"
    })),
    ["student_id", "roll_no", "student_name", "dept_name", "sem_number", "assigned_faculty"],
    "No students found."
  );
}

document.getElementById("studentForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const studentId = document.getElementById("studentId").value.trim();
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
    if (studentId) {
      await studentApp.submitJson(`/api/students/${studentId}`, "PUT", payload);
      studentApp.setStatus("Student updated successfully.", "success");
    } else {
      await studentApp.submitJson("/api/students", "POST", payload);
      studentApp.setStatus("Student added successfully.", "success");
    }

    event.target.reset();
    await loadStudentPage();
  } catch (error) {
    studentApp.setStatus(error.message, "error");
  }
});

document.getElementById("deleteStudentForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    const result = await studentApp.fetchJson(`/api/students/${document.getElementById("deleteStudentId").value}`, {
      method: "DELETE"
    });
    if (!result.ok) {
      throw new Error(result.data.message || "Unable to delete student.");
    }
    event.target.reset();
    studentApp.setStatus("Student deleted successfully.", "success");
    await loadStudentPage();
  } catch (error) {
    studentApp.setStatus(error.message, "error");
  }
});

document.getElementById("studentResetButton").addEventListener("click", () => {
  document.getElementById("studentForm").reset();
});

document.getElementById("searchButton").addEventListener("click", () => {
  loadStudentPage().catch((error) => studentApp.setStatus(error.message, "error"));
});

document.getElementById("refreshButton").addEventListener("click", () => {
  document.getElementById("studentSearch").value = "";
  document.getElementById("departmentFilter").value = "";
  loadStudentPage().catch((error) => studentApp.setStatus(error.message, "error"));
});

loadStudentPage().catch((error) => studentApp.setStatus(error.message, "error"));
