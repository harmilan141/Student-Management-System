const resultApp = window.AdminApp;

async function loadResultsPage() {
  const [lookupsResult, dashboardResult] = await Promise.all([
    resultApp.fetchJson("/api/lookups"),
    resultApp.fetchJson("/api/dashboard-data")
  ]);

  if (!lookupsResult.ok) {
    throw new Error(lookupsResult.data.message || "Unable to load semester list.");
  }

  if (!dashboardResult.ok) {
    throw new Error(dashboardResult.data.message || "Unable to load results.");
  }

  resultApp.fillSelect(
    "resultSemester",
    lookupsResult.data.semesters,
    "sem_id",
    (item) => `${item.sem_number} - ${item.sem_name}`
  );

  resultApp.renderTableBody(
    "resultsTableBody",
    dashboardResult.data.results.map((item) => ({
      roll_no: item.roll_no,
      student_name: item.student_name,
      sem_number: item.sem_number,
      gpa: item.gpa,
      pass_fail_status: item.pass_fail_status
    })),
    ["roll_no", "student_name", "sem_number", "gpa", "pass_fail_status"],
    "No results found."
  );
}

document.getElementById("resultForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    await resultApp.submitJson("/api/results/generate", "POST", {
      rollNo: document.getElementById("resultRollNo").value.trim(),
      semId: document.getElementById("resultSemester").value
    });
    event.target.reset();
    resultApp.setStatus("Semester result generated successfully.", "success");
    await loadResultsPage();
  } catch (error) {
    resultApp.setStatus(error.message, "error");
  }
});

loadResultsPage().catch((error) => resultApp.setStatus(error.message, "error"));
