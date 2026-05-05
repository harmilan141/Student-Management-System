// results.js — Uses PL/SQL sp_calculate_and_store_result via /api/results/generate
// Also supports /api/results/recalculate-all → sp_recalculate_all_results

const resultApp = window.AdminApp;

// ── Render a Pass/Fail badge instead of raw text ──────────────
function renderStatusBadge(status) {
  if (!status || status === "PENDING" || status === "-") {
    return `<span class="badge badge-pending">PENDING</span>`;
  }
  const upper = String(status).toUpperCase();
  if (upper === "PASS") {
    return `<span class="badge badge-pass">PASS</span>`;
  }
  if (upper === "FAIL") {
    return `<span class="badge badge-fail">FAIL</span>`;
  }
  return `<span class="badge badge-pending">${status}</span>`;
}

// ── Render results table with badge in Status column ──────────
function renderResultsTable(results) {
  const tbody = document.getElementById("resultsTableBody");
  tbody.innerHTML = "";

  if (!results || !results.length) {
    tbody.innerHTML = '<tr><td colspan="6">No students with marks found.</td></tr>';
    return;
  }

  results.forEach((item) => {
    const isPending = !item.status || item.status === "PENDING";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.roll_no ?? "-"}</td>
      <td>${item.student_name ?? "-"}</td>
      <td>${item.sem_number ?? "-"}</td>
      <td>${item.gpa != null ? Number(item.gpa).toFixed(2) : "-"}</td>
      <td>${renderStatusBadge(item.pass_fail_status ?? item.status)}</td>
      <td>${isPending
        ? `<button class="secondary-button gen-btn" data-roll="${item.roll_no}" data-sem="${item.sem_number}" style="padding:4px 10px;font-size:0.8rem;">Generate</button>`
        : ""
      }</td>
    `;
    tbody.appendChild(tr);
  });

  // Attach click handlers to inline Generate buttons
  tbody.querySelectorAll(".gen-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      btn.textContent = "…";
      try {
        const semSelect = document.getElementById("resultSemester");
        // Find sem_id matching the sem_number for this row
        const semOption = Array.from(semSelect.options).find(
          (o) => o.text.startsWith(btn.dataset.sem + " -")
        );
        if (!semOption) throw new Error("Semester not found in dropdown.");

        const studentSelect = document.getElementById("resultStudent");
        const studentOption = Array.from(studentSelect.options).find(
          (o) => o.text.startsWith(btn.dataset.roll)
        );
        if (!studentOption) throw new Error("Student not found in dropdown.");

        const response = await resultApp.submitJson("/api/results/generate", "POST", {
          studentId: studentOption.value,
          semId: semOption.value
        });
        resultApp.setStatus(
          `Result generated — GPA: ${response.data.gpa}, Status: ${response.data.status}`,
          "success"
        );
        await loadResultsPage();
      } catch (error) {
        resultApp.setStatus(error.message, "error");
        btn.disabled = false;
        btn.textContent = "Generate";
      }
    });
  });
}

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

  resultApp.fillSelect(
    "resultStudent",
    lookupsResult.data.students,
    "student_id",
    (item) => `${item.roll_no} - ${item.student_name}`
  );

  renderResultsTable(dashboardResult.data.results);
}

// Generate result for one student in one semester
document.getElementById("resultForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    const response = await resultApp.submitJson("/api/results/generate", "POST", {
      studentId: document.getElementById("resultStudent").value,
      semId:     document.getElementById("resultSemester").value
    });

    event.target.reset();
    resultApp.setStatus(
      `Result generated — GPA: ${response.data.gpa}, Status: ${response.data.status}`,
      "success"
    );
    await loadResultsPage();
  } catch (error) {
    resultApp.setStatus(error.message, "error");
  }
});

// Recalculate ALL results at once
const recalcBtn = document.getElementById("recalcAllBtn");
if (recalcBtn) {
  recalcBtn.addEventListener("click", async () => {
    recalcBtn.disabled = true;
    recalcBtn.textContent = "Recalculating…";
    try {
      await resultApp.submitJson("/api/results/recalculate-all", "POST", {});
      resultApp.setStatus("All results recalculated successfully.", "success");
      await loadResultsPage();
    } catch (error) {
      resultApp.setStatus(error.message, "error");
    } finally {
      recalcBtn.disabled = false;
      recalcBtn.textContent = "Recalculate All Results";
    }
  });
}

loadResultsPage().catch((error) => resultApp.setStatus(error.message, "error"));