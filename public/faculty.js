const facultyApp = window.AdminApp;

function renderFacultyRows(facultyRows) {
  const body = document.getElementById("facultyTableBody");
  body.innerHTML = "";

  if (!facultyRows.length) {
    body.innerHTML = '<tr><td colspan="6">No faculty found.</td></tr>';
    return;
  }

  facultyRows.forEach((item) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.faculty_id ?? "-"}</td>
      <td>${item.faculty_code ?? "-"}</td>
      <td>${item.faculty_name ?? "-"}</td>
      <td>${item.designation ?? "-"}</td>
      <td>${item.dept_name ?? "-"}</td>
      <td><button class="danger-button" data-delete-faculty="${item.faculty_id}" type="button">Delete</button></td>
    `;
    body.appendChild(tr);
  });
}

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

  renderFacultyRows(dashboardResult.data.faculty);
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

document.getElementById("facultyTableBody").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-delete-faculty]");
  if (!button) return;

  const ok = window.confirm("Delete this faculty record? This also releases their course assignments.");
  if (!ok) return;

  try {
    const result = await facultyApp.fetchJson(`/api/faculty/${button.dataset.deleteFaculty}`, {
      method: "DELETE"
    });
    if (!result.ok) {
      throw new Error(result.data.message || "Unable to delete faculty.");
    }
    facultyApp.setStatus("Faculty deleted successfully.", "success");
    await loadFacultyPage();
  } catch (error) {
    facultyApp.setStatus(error.message, "error");
  }
});

loadFacultyPage().catch((error) => facultyApp.setStatus(error.message, "error"));
