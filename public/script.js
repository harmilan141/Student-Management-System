// ────────────────────────────────────────────────────────────────
//  Login page script  (script.js)
//  Fixes:
//    • roleCard / helperNote now selected by ID (matches fixed login.html)
//    • Password-toggle uses class .toggle-password (matches fixed login.html)
//    • updateRole() reliably updates the sliding role card & helper text
// ────────────────────────────────────────────────────────────────

const roles = {
  admin: {
    title: "Administrator Login",
    description: "Manage departments, students, faculty, courses, marks, GPA, and results.",
    placeholder: "Enter admin username",
    helper: "Sample admin login: harmilan_admin / admin123"
  },
  student: {
    title: "Student Login",
    description: "View your profile, marks, grades, and GPA.",
    placeholder: "Enter roll number",
    helper: "Sample student login: 2024CSE001 / student123"
  },
  faculty: {
    title: "Faculty Login",
    description: "Manage courses, marks, and activity log.",
    placeholder: "Enter faculty code",
    helper: "Sample faculty login: FAC001 / faculty123"
  }
};

// FIX: select elements by ID — these IDs exist in the fixed login.html
const roleButtons   = document.querySelectorAll(".role-chip");
const roleCard      = document.getElementById("roleCard");       // was missing in old HTML
const loginForm     = document.getElementById("loginForm");
const loginUserId   = document.getElementById("loginUserId");
const helperNote    = document.getElementById("helperNote");     // was missing in old HTML
const statusMessage = document.getElementById("statusMessage");

let currentRole = "admin";

function setStatus(message, type = "") {
  if (!statusMessage) return;
  statusMessage.textContent = message;
  statusMessage.className = "status-message";
  if (type) statusMessage.classList.add(type);
}

function updateRole(role) {
  currentRole = role;
  const selected = roles[role];
  if (!selected) return;

  // Highlight the active chip
  roleButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.role === role);
  });

  // FIX: update role card content (was silently failing — roleCard was null)
  if (roleCard) {
    roleCard.innerHTML = `<h3>${selected.title}</h3><p>${selected.description}</p>`;
  }

  // FIX: update placeholder & helper text (was silently failing — helperNote was null)
  if (loginUserId) loginUserId.placeholder = selected.placeholder;
  if (helperNote)  helperNote.textContent  = selected.helper;

  setStatus("");
}

// Password toggle — class .toggle-password is now present in fixed login.html
document.querySelectorAll(".toggle-password").forEach((button) => {
  button.addEventListener("click", () => {
    const targetInput = document.getElementById("loginPassword");
    if (!targetInput) return;
    const isHidden = targetInput.type === "password";
    targetInput.type = isHidden ? "text" : "password";
    button.textContent = isHidden ? "Hide" : "Show";
  });
});

// Role chip click → switch sliding role card
roleButtons.forEach((button) => {
  button.addEventListener("click", () => {
    updateRole(button.dataset.role);
  });
});

// Login submit
if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const payload = {
      userId:   loginUserId ? loginUserId.value.trim() : "",
      password: document.getElementById("loginPassword")
                  ? document.getElementById("loginPassword").value
                  : "",
      role: currentRole
    };

    const submitBtn   = loginForm.querySelector("button[type='submit']");
    const originalHtml = submitBtn.innerHTML;

    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Signing in...';
    submitBtn.disabled  = true;

    try {
      const response = await fetch("/api/login", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        setStatus(data.message || "Login failed.", "error");
        submitBtn.innerHTML = originalHtml;
        submitBtn.disabled  = false;
        return;
      }

      localStorage.setItem("smsUser", JSON.stringify(data.user));
      setStatus("Login successful. Redirecting...", "success");

      setTimeout(() => {
        window.location.href =
          currentRole === "admin" ? "dashboard.html" : "user-dashboard.html";
      }, 600);

    } catch (error) {
      setStatus("Server error. Check backend.", "error");
      submitBtn.innerHTML = originalHtml;
      submitBtn.disabled  = false;
    }
  });
}

// Initialise default role on page load
updateRole("admin");
