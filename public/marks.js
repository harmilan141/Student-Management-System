const marksApp = window.AdminApp;

async function loadMarksPage() {
  const [lookupsResult, dashboardResult] = await Promise.all([
    marksApp.fetchJson("/api/lookups"),
    marksApp.fetchJson("/api/dashboard-data")
  ]);

  if (!lookupsResult.ok) {
    throw new Error(lookupsResult.data.message || "Unable to load marks form data.");
  }

  if (!dashboardResult.ok) {
    throw new Error(dashboardResult.data.message || "Unable to load marks.");
  }

  marksApp.fillSelect("marksCourse", lookupsResult.data.courses, "course_id", (item) => `${item.course_code} - ${item.course_name}`);
  marksApp.fillSelect("marksFaculty", lookupsResult.data.faculty, "faculty_id", (item) => `${item.faculty_code} - ${item.faculty_name}`);

  marksApp.renderTableBody(
    "marksTableBody",
    dashboardResult.data.marks.map((item) => ({
      marks_id: item.marks_id,
      roll_no: item.roll_no,
      course_code: `${item.course_code} - ${item.course_name}`,
      faculty_code: `${item.faculty_code} - ${item.faculty_name}`,
      marks_obtained: item.marks_obtained,
      grade: `${item.grade} (${item.grade_point})`
    })),
    ["marks_id", "roll_no", "course_code", "faculty_code", "marks_obtained", "grade"],
    "No marks found."
  );

  marksApp.renderTableBody(
    "activityTableBody",
    dashboardResult.data.activityLogs.map((item) => ({
      faculty_name: `${item.faculty_code} - ${item.faculty_name}`,
      roll_no: item.roll_no,
      course_code: item.course_code,
      old_marks: item.old_marks ?? "-",
      new_marks: item.new_marks ?? "-",
      action_time: new Date(item.action_time).toLocaleString()
    })),
    ["faculty_name", "roll_no", "course_code", "old_marks", "new_marks", "action_time"],
    "No activity logs found."
  );
}

document.getElementById("marksForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const marksId = document.getElementById("marksId").value.trim();

  try {
    if (marksId) {
      await marksApp.submitJson(`/api/marks/${marksId}`, "PUT", {
        marksObtained: document.getElementById("marksObtained").value,
        facultyId: document.getElementById("marksFaculty").value
      });
      marksApp.setStatus("Marks updated successfully.", "success");
    } else {
      await marksApp.submitJson("/api/marks", "POST", {
        rollNo: document.getElementById("marksRollNo").value.trim(),
        courseId: document.getElementById("marksCourse").value,
        facultyId: document.getElementById("marksFaculty").value,
        marksObtained: document.getElementById("marksObtained").value
      });
      marksApp.setStatus("Marks entered successfully.", "success");
    }

    event.target.reset();
    await loadMarksPage();
  } catch (error) {
    marksApp.setStatus(error.message, "error");
  }
});

loadMarksPage().catch((error) => marksApp.setStatus(error.message, "error"));
