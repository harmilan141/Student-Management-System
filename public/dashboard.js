// dashboard.js — Admin Overview Page
// Only handles stat counts and charts via /api/overview-data
// Department CRUD lives in departments.js (departments.html)

const dashboardApp = window.AdminApp;

async function loadOverview() {
  try {
    const result = await dashboardApp.fetchJson("/api/overview-data");
    if (!result.ok) {
      throw new Error(result.data.message || "Unable to load overview data.");
    }

    const counts = result.data.counts || {};

    // ── Stat cards ───────────────────────────────────────────
    const studentCountEl    = document.getElementById("studentCount");
    const facultyCountEl    = document.getElementById("facultyCount");
    const courseCountEl     = document.getElementById("courseCount");
    const departmentCountEl = document.getElementById("departmentCount");

    if (studentCountEl)    studentCountEl.textContent    = counts.students    ?? 0;
    if (facultyCountEl)    facultyCountEl.textContent    = counts.faculty     ?? 0;
    if (courseCountEl)     courseCountEl.textContent     = counts.courses     ?? 0;
    if (departmentCountEl) departmentCountEl.textContent = counts.departments ?? 0;

    // ── Charts ───────────────────────────────────────────────
    const results = result.data.results || [];

    // GPA Trend chart
    const gpaCanvas = document.getElementById("gpaChart");
    if (gpaCanvas && typeof Chart !== "undefined") {
      const gpas   = results.map(r => parseFloat(r.gpa) || 0);
      const labels = results.map((_, i) => "#" + (i + 1));

      new Chart(gpaCanvas.getContext("2d"), {
        type: "line",
        data: {
          labels: labels,
          datasets: [{
            label:           "GPA",
            data:            gpas,
            borderColor:     "#4f8cff",
            backgroundColor: "rgba(79,140,255,0.12)",
            borderWidth:     2,
            pointRadius:     2,
            tension:         0.3,
            fill:            true
          }]
        },
        options: {
          responsive:          true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales:  {
            y: { min: 0, max: 10, ticks: { stepSize: 2 } },
            x: { display: false }
          }
        }
      });
    }

    // Records Breakdown chart
    const breakdownCanvas = document.getElementById("breakdownChart");
    if (breakdownCanvas && typeof Chart !== "undefined") {
      new Chart(breakdownCanvas.getContext("2d"), {
        type: "doughnut",
        data: {
          labels: ["Students", "Faculty", "Courses", "Departments"],
          datasets: [{
            data: [
              counts.students    ?? 0,
              counts.faculty     ?? 0,
              counts.courses     ?? 0,
              counts.departments ?? 0
            ],
            backgroundColor: ["#4f8cff", "#38c98b", "#f5a623", "#e05c5c"],
            borderWidth: 2
          }]
        },
        options: {
          responsive:          true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "bottom" }
          }
        }
      });
    }

  } catch (error) {
    dashboardApp.setStatus("Error loading overview: " + error.message, "error");
  }
}

// Load on page ready
loadOverview();