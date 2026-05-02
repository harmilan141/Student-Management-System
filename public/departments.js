// departments.js — Department Management Page

const departmentApp = window.AdminApp;

// ── Load and render department list ──────────────────────────
async function loadDepartments() {
  try {
    const result = await departmentApp.fetchJson("/api/departments");
    if (!result.ok) {
      throw new Error(result.data.message || "Unable to load departments.");
    }
    departmentApp.renderTableBody(
      "departmentsTableBody",
      result.data.departments,
      ["dept_id", "dept_code", "dept_name"],
      "No departments found."
    );
  } catch (error) {
    departmentApp.setStatus("Error loading list: " + error.message, "error");
  }
}

// ── Save Department (Add or Update) ──────────────────────────
document.getElementById("departmentForm").addEventListener("submit", async function (event) {
  event.preventDefault();

  const deptId   = document.getElementById("departmentId").value.trim();
  const deptCode = document.getElementById("deptCode").value.trim();
  const deptName = document.getElementById("deptName").value.trim();

  if (!deptCode || !deptName) {
    alert("Please fill in Department Code and Department Name.");
    return;
  }

  try {
    if (deptId) {
      // ── UPDATE existing department ──
      const res = await fetch("/api/departments/" + deptId, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ deptCode: deptCode, deptName: deptName })
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.message || "Failed to update department.");
      }

      alert("Department updated successfully!\n\nID: " + deptId + "\nCode: " + deptCode + "\nName: " + deptName);
      departmentApp.setStatus("Department updated successfully.", "success");

    } else {
      // ── ADD new department ──
      const res = await fetch("/api/departments", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ deptCode: deptCode, deptName: deptName })
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.message || "Failed to add department.");
      }

      alert("Department added successfully!\n\nNew ID: " + data.deptId + "\nCode: " + deptCode + "\nName: " + deptName);
      departmentApp.setStatus("Department added successfully.", "success");
    }

    // Reset form and reload list
    document.getElementById("departmentForm").reset();
    await loadDepartments();

  } catch (error) {
    // Show a clear message distinguishing add vs update failure
    var action = deptId ? "update" : "add";
    var hint   = deptId
      ? "\n\nHint: Make sure ID " + deptId + " exists in the list."
      : "\n\nHint: Leave the ID field empty when adding a new department.";
    alert("Error trying to " + action + " department:\n" + error.message + hint);
    departmentApp.setStatus(error.message, "error");
  }
});

// ── Clear button ──────────────────────────────────────────────
document.getElementById("departmentResetButton").addEventListener("click", function () {
  document.getElementById("departmentForm").reset();
  departmentApp.setStatus("", "");
});

// ── Load list on page ready ───────────────────────────────────
loadDepartments();  