const semesterApp = window.AdminApp;

async function loadSemesters() {
  const result = await semesterApp.fetchJson("/api/dashboard-data");
  if (!result.ok) {
    throw new Error(result.data.message || "Unable to load semesters.");
  }

  semesterApp.renderTableBody(
    "semestersTableBody",
    result.data.semesters,
    ["sem_id", "sem_number", "sem_name"],
    "No semesters found."
  );
}

document.getElementById("semesterForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    await semesterApp.submitJson("/api/semesters", "POST", {
      semNumber: document.getElementById("semNumber").value,
      semName: document.getElementById("semName").value.trim()
    });
    event.target.reset();
    semesterApp.setStatus("Semester added successfully.", "success");
    await loadSemesters();
  } catch (error) {
    semesterApp.setStatus(error.message, "error");
  }
});

loadSemesters().catch((error) => semesterApp.setStatus(error.message, "error"));
