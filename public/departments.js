const departmentApp = window.AdminApp;

async function loadDepartments() {
  const result = await departmentApp.fetchJson("/api/dashboard-data");
  if (!result.ok) {
    throw new Error(result.data.message || "Unable to load departments.");
  }

  departmentApp.renderTableBody(
    "departmentsTableBody",
    result.data.departments,
    ["dept_id", "dept_code", "dept_name"],
    "No departments found."
  );
}

document.getElementById("departmentForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const deptId = document.getElementById("departmentId").value.trim();
  const payload = {
    deptCode: document.getElementById("deptCode").value.trim(),
    deptName: document.getElementById("deptName").value.trim()
  };

  try {
    if (deptId) {
      await departmentApp.submitJson(`/api/departments/${deptId}`, "PUT", payload);
      departmentApp.setStatus("Department updated successfully.", "success");
    } else {
      await departmentApp.submitJson("/api/departments", "POST", payload);
      departmentApp.setStatus("Department added successfully.", "success");
    }

    event.target.reset();
    await loadDepartments();
  } catch (error) {
    departmentApp.setStatus(error.message, "error");
  }
});

document.getElementById("departmentResetButton").addEventListener("click", () => {
  document.getElementById("departmentForm").reset();
});

loadDepartments().catch((error) => departmentApp.setStatus(error.message, "error"));
