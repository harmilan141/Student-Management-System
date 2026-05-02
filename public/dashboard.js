const Admin = window.AdminApp || {};
const fetchJson = Admin.fetchJson;
const renderTableBody = Admin.renderTableBody;
const setStatus = Admin.setStatus || (() => {});

let gpaChartInstance = null;
let breakdownChartInstance = null;

function renderCharts(data) {
  if (typeof Chart === "undefined") return;

  const green = "#10b981", mint = "#6ee7b7", darkGreen = "#065f46";

  const counts = data.counts || {
    students: 0,
    faculty: 0,
    courses: 0,
    departments: 0
  };

  // GPA CHART
  const gpaEl = document.getElementById("gpaChart");
  if (gpaEl) {
    if (gpaChartInstance) gpaChartInstance.destroy();

    const buckets = [0, 0, 0, 0, 0];

    (data.results || []).forEach((r) => {
      const g = Number(r.gpa) || 0;
      if (g < 6) buckets[0]++;
      else if (g < 7) buckets[1]++;
      else if (g < 8) buckets[2]++;
      else if (g < 9) buckets[3]++;
      else buckets[4]++;
    });

    const hasAny = buckets.some(v => v > 0);

    gpaChartInstance = new Chart(gpaEl.getContext("2d"), {
      type: "bar",
      data: {
        labels: ["<6.0", "6.0–6.9", "7.0–7.9", "8.0–8.9", "9.0–10"],
        datasets: [{
          label: "Students",
          data: hasAny ? buckets : [3, 5, 9, 12, 6],
          backgroundColor: [mint, mint, green, green, darkGreen],
          borderRadius: 8,
          barThickness: 34
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } }
      }
    });
  }

  // BREAKDOWN CHART
  const bEl = document.getElementById("breakdownChart");
  if (bEl) {
    if (breakdownChartInstance) breakdownChartInstance.destroy();

    breakdownChartInstance = new Chart(bEl.getContext("2d"), {
      type: "doughnut",
      data: {
        labels: ["Students", "Faculty", "Courses", "Departments"],
        datasets: [{
          data: [
            counts.students,
            counts.faculty,
            counts.courses,
            counts.departments
          ],
          backgroundColor: ["#10b981", "#34d399", "#6ee7b7", "#065f46"],
          borderColor: "#fff",
          borderWidth: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "65%"
      }
    });
  }
}

async function loadOverview() {
  try {
    if (!fetchJson) throw new Error("AdminApp not loaded");

    const result = await fetchJson("/api/overview-data");
    if (!result.ok) throw new Error(result.data.message);

    const data = result.data;
    const counts = data.counts || {};

    document.getElementById("studentCount").textContent = counts.students || 0;
    document.getElementById("facultyCount").textContent = counts.faculty || 0;
    document.getElementById("courseCount").textContent = counts.courses || 0;
    document.getElementById("departmentCount").textContent = counts.departments || 0;

    renderCharts(data);

  } catch (error) {
    setStatus(error.message || "Error loading data", "error");

    renderCharts({
      counts: { students: 0, faculty: 0, courses: 0, departments: 0 },
      results: []
    });
  }
}

loadOverview();