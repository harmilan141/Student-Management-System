const savedUser = localStorage.getItem("smsUser");

if (!savedUser) {
  window.location.href = "index.html";
}

const user = savedUser ? JSON.parse(savedUser) : null;
if (user && user.role === "admin") {
  window.location.href = "dashboard.html";
}

const userStatus = document.getElementById("userStatus");
const userDetails = document.getElementById("userDetails");

function setUserStatus(message, type = "") {
  userStatus.textContent = message;
  userStatus.className = "status-message";
  if (type) {
    userStatus.classList.add(type);
  }
}

function renderDetail(label, value) {
  return `<div><span>${label}</span><strong>${value || "-"}</strong></div>`;
}

function renderSimpleTable(title, headers, rows) {
  if (!rows.length) {
    return `
      <section class="card">
        <div class="panel-header"><h2>${title}</h2></div>
        <p class="subtitle">No records found.</p>
      </section>`;
  }

  const head = headers.map((header) => `<th>${header}</th>`).join("");
  const body = rows.map((row) => `<tr>${row.map((cell) => `<td>${cell ?? "-"}</td>`).join("")}</tr>`).join("");

  return `
    <section class="card">
      <div class="panel-header"><h2>${title}</h2></div>
      <div class="table-wrap">
        <table>
          <thead><tr>${head}</tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    </section>`;
}

async function loadUserProfile() {
  if (!user) {
    return;
  }

  document.getElementById("userName").textContent = user.full_name;
  document.getElementById("userEmail").textContent = user.email;
  document.getElementById("userRoleLabel").textContent = `${user.role} portal`.toUpperCase();
  document.getElementById("userDashboardHeading").textContent = `${user.role[0].toUpperCase()}${user.role.slice(1)} Dashboard`;

  try {
    const endpoint = user.role === "student" ? `/api/student/${user.user_id}` : `/api/faculty/${user.user_id}`;
    const response = await fetch(endpoint);
    const data = await response.json();

    if (!response.ok) {
      setUserStatus(data.message || "Unable to load profile.", "error");
      return;
    }

    const content = document.getElementById("userContent");

    if (user.role === "student") {
      document.getElementById("userDashboardIntro").textContent = "View your profile, marks, grades, and semester results.";
      userDetails.innerHTML =
        renderDetail("Roll No", data.student.roll_no) +
        renderDetail("University Roll No", data.student.university_roll_no) +
        renderDetail("Department", data.student.dept_name) +
        renderDetail("Semester", data.student.sem_name) +
        renderDetail("Phone", data.student.phone_no) +
        renderDetail("Batch", data.student.batch);

      content.innerHTML =
        renderSimpleTable(
          "Marks and Grades",
          ["Course", "Credits", "Marks", "Grade", "Grade Point", "Faculty"],
          data.marks.map((item) => [
            `${item.course_code} - ${item.course_name}`,
            item.credits,
            item.marks_obtained,
            item.grade,
            item.grade_point,
            item.faculty_name
          ])
        ) +
        renderSimpleTable(
          "Semester Results",
          ["Semester", "GPA", "Status", "Generated At"],
          data.results.map((item) => [item.sem_number, item.gpa, item.pass_fail_status, new Date(item.generated_at).toLocaleString()])
        );
    } else {
      document.getElementById("userDashboardIntro").textContent = "View your profile, assigned courses, and recent mark activities.";
      userDetails.innerHTML =
        renderDetail("Faculty Code", data.faculty.faculty_code) +
        renderDetail("Employee ID", data.faculty.emp_id) +
        renderDetail("Department", data.faculty.dept_name) +
        renderDetail("Designation", data.faculty.designation) +
        renderDetail("Qualification", data.faculty.qualification) +
        renderDetail("Specialization", data.faculty.specialization);

      content.innerHTML =
        renderSimpleTable(
          "Assigned Courses",
          ["Course", "Credits", "Semester", "Department"],
          data.courses.map((item) => [
            `${item.course_code} - ${item.course_name}`,
            item.credits,
            item.sem_number,
            item.dept_name
          ])
        ) +
        renderSimpleTable(
          "Activity Log",
          ["Action", "Student", "Course", "Old Marks", "New Marks", "Time"],
          data.activities.map((item) => [
            item.action_type,
            item.roll_no,
            item.course_code,
            item.old_marks ?? "-",
            item.new_marks ?? "-",
            new Date(item.action_time).toLocaleString()
          ])
        );
    }
  } catch (error) {
    setUserStatus("Server error while loading profile.", "error");
  }
}

document.getElementById("userLogoutButton").addEventListener("click", () => {
  localStorage.removeItem("smsUser");
  window.location.href = "index.html";
});

loadUserProfile();
