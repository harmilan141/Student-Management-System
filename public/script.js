const roles = {
  admin: {
    title: "Administrator Login",
    description: "Manage departments, students, faculty, courses, marks, GPA, and results.",
    placeholder: "Enter admin username",
    helper: "Sample admin login: harmilan_admin / admin123"
  },
  student: {
    title: "Student Login",
    description: "View your profile, marks, grades, and semester-wise GPA.",
    placeholder: "Enter roll number",
    helper: "Sample student login: STU101 / student123"
  },
  faculty: {
    title: "Faculty Login",
    description: "View your department profile, assigned courses, and mark activity log.",
    placeholder: "Enter faculty code",
    helper: "Sample faculty login: FAC301 / faculty123"
  }
};

const roleButtons = document.querySelectorAll(".role-chip");
const roleCard = document.getElementById("roleCard");
const loginForm = document.getElementById("loginForm");
const loginUserId = document.getElementById("loginUserId");
const helperNote = document.getElementById("helperNote");
const statusMessage = document.getElementById("statusMessage");

let currentRole = "admin";

function setStatus(message, type = "") {
  statusMessage.textContent = message;
  statusMessage.className = "status-message";

  if (type) {
    statusMessage.classList.add(type);
  }
}

function updateRole(role) {
  currentRole = role;
  const selected = roles[role];

  roleButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.role === role);
  });

  roleCard.innerHTML = `
    <h3>${selected.title}</h3>
    <p>${selected.description}</p>
  `;

  loginUserId.placeholder = selected.placeholder;
  helperNote.textContent = selected.helper;
  setStatus("");
}

document.querySelectorAll(".toggle-password").forEach((button) => {
  button.addEventListener("click", () => {
    const targetInput = document.getElementById(button.dataset.target);
    const isHidden = targetInput.type === "password";

    targetInput.type = isHidden ? "text" : "password";
    button.textContent = isHidden ? "Hide" : "Show";
  });
});

roleButtons.forEach((button) => {
  button.addEventListener("click", () => updateRole(button.dataset.role));
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const payload = {
    userId: document.getElementById("loginUserId").value.trim(),
    password: document.getElementById("loginPassword").value,
    role: currentRole
  };

  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      setStatus(data.message || "Login failed.", "error");
      return;
    }

    localStorage.setItem("smsUser", JSON.stringify(data.user));
    setStatus("Login successful. Redirecting...", "success");

    setTimeout(() => {
      window.location.href = currentRole === "admin" ? "dashboard.html" : "user-dashboard.html";
    }, 700);
  } catch (error) {
    setStatus("Server error. Please check if the Node.js server is running.", "error");
  }
});

updateRole("admin");
