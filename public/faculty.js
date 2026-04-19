const facultyApp = window.AdminApp;

async function loadFacultyPage() {
  const [lookupsResult, dashboardResult] = await Promise.all([
    facultyApp.fetchJson("/api/lookups"),
    facultyApp.fetchJson("/api/dashboard-data")
  ]);

  if (!lookupsResult.ok) {
    throw new Error(lookupsResult.data.message || "Unable to load department data.");
  }

  if (!dashboardResult.ok) {
    throw new Error(dashboardResult.data.message || "Unable to load faculty data.");
  }

  facultyApp.fillSelect(
    "facultyDepartment",
    lookupsResult.data.departments,
    "dept_id",
    (item) => `${item.dept_code} - ${item.dept_name}`
  );

  facultyApp.renderTableBody(
    "facultyTableBody",
    dashboardResult.data.faculty,
    ["faculty_id", "faculty_code", "faculty_name", "designation", "dept_name"],
    "No faculty found."
  );
}

document.getElementById("facultyForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const facultyId = document.getElementById("facultyId").value.trim();
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
    if (facultyId) {
      await facultyApp.submitJson(`/api/faculty/${facultyId}`, "PUT", payload);
      facultyApp.setStatus("Faculty updated successfully.", "success");
    } else {
      await facultyApp.submitJson("/api/faculty", "POST", payload);
      facultyApp.setStatus("Faculty added successfully.", "success");
    }

    event.target.reset();
    await loadFacultyPage();
  } catch (error) {
    facultyApp.setStatus(error.message, "error");
  }
});

document.getElementById("facultyResetButton").addEventListener("click", () => {
  document.getElementById("facultyForm").reset();
});

loadFacultyPage().catch((error) => facultyApp.setStatus(error.message, "error"));
