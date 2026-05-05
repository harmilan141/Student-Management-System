// ────────────────────────────────────────────────────────────────
//  server.js  — Student Management System
//  Updated to use PL/SQL stored procedures for all business logic
//
//  PL/SQL objects used:
//    PROCEDURES:
//      sp_enroll_student         → add new student
//      sp_add_faculty            → add new faculty
//      sp_update_marks           → insert/update marks + auto-log + auto-result
//      sp_calculate_and_store_result → regenerate one student's result
//      sp_recalculate_all_results    → recalculate all results
//      sp_get_student_transcript     → full student transcript
//      sp_department_performance_report → department analytics
//    FUNCTIONS (called inside SQL queries):
//      calculate_gpa(student_id, sem_id)
//      get_pass_fail(student_id, sem_id)
//      get_grade_letter(percentage)
//    TRIGGERS (fire automatically — no JS needed):
//      trg_after_marks_insert            → recalcs result on insert
//      trg_after_marks_update            → recalcs result on update
//      trg_prevent_marks_above_max_*     → validation on marks
//      trg_log_faculty_marks_update      → auto activity log on update
// ────────────────────────────────────────────────────────────────

const path    = require("path");
const express = require("express");
const mysql   = require("mysql2/promise");
const dotenv  = require("dotenv");
const crypto  = require("crypto");
const fs      = require("fs");

dotenv.config();

const app       = express();
const port      = process.env.PORT || 3000;
const publicDir = path.join(__dirname, "public");

// ─── DB POOL ──────────────────────────────────────────────────
const pool = mysql.createPool({
  host:     process.env.DB_HOST,
  port:     Number(process.env.DB_PORT),
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: {
    ca: fs.readFileSync(path.join(__dirname, "ca.pem"))
  },
  waitForConnections: true,
  connectionLimit: 10
});

(async () => {
  try {
    await pool.query("SELECT 1");
    console.log("DB Connected ✅");
  } catch (err) {
    console.error("DB Connection Failed ❌", err.message);
  }
})();

app.use(express.json());
app.use(express.static(publicDir));

// ─── REQUEST LOGGER ──────────────────────────────────────────
app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`, req.body && Object.keys(req.body).length ? JSON.stringify(req.body) : "");
  }
  next();
});

// ─── HELPERS ─────────────────────────────────────────────────
function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function isDuplicateError(error) {
  return error && error.code === "ER_DUP_ENTRY";
}

function credentialsMatch(row, password) {
  const hashedPassword = hashPassword(password);
  return row.password_hash === hashedPassword || row.password === password || row.password === hashedPassword;
}

// ─── HEALTH ──────────────────────────────────────────────────
app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, message: "Server and database connection are working." });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Database connection failed.", error: error.message });
  }
});

// ─── LOGIN ───────────────────────────────────────────────────
app.post("/api/login", async (req, res) => {
  const { userId, password, role } = req.body;

  if (!userId || !password || !role) {
    return res.status(400).json({ ok: false, message: "User ID, password, and role are required." });
  }

  const queries = {
    admin: {
      sql: `SELECT id AS admin_id, admin_username AS user_id, name AS full_name, email,
                   password, password_hash, 'admin' AS role
            FROM admins
            WHERE admin_username = ? OR email = ?
            LIMIT 1`
    },
    student: {
      sql: `SELECT id AS student_id, roll_no AS user_id, student_name AS full_name, email,
                   password, password_hash, 'student' AS role
            FROM students
            WHERE roll_no = ? OR email = ?
            LIMIT 1`
    },
    faculty: {
      sql: `SELECT id AS faculty_id, faculty_code AS user_id, faculty_name AS full_name, email,
                   password, password_hash, 'faculty' AS role
            FROM faculty
            WHERE faculty_code = ? OR email = ?
            LIMIT 1`
    }
  };

  const config = queries[role];
  if (!config) {
    return res.status(400).json({ ok: false, message: "Invalid role selected." });
  }

  try {
    const [rows] = await pool.query(config.sql, [userId, userId]);

    if (rows.length === 0 || !credentialsMatch(rows[0], password)) {
      return res.status(401).json({ ok: false, message: "Invalid credentials or role." });
    }

    const { password: _password, password_hash: _passwordHash, ...user } = rows[0];
    res.json({ ok: true, user });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Unable to log in.", error: error.message });
  }
});

// ─── OVERVIEW DATA ───────────────────────────────────────────
app.get("/api/overview-data", async (req, res) => {
  try {
    const [[studentsRow]]    = await pool.query("SELECT COUNT(*) AS cnt FROM students");
    const [[facultyRow]]     = await pool.query("SELECT COUNT(*) AS cnt FROM faculty");
    const [[coursesRow]]     = await pool.query("SELECT COUNT(*) AS cnt FROM courses");
    const [[departmentsRow]] = await pool.query("SELECT COUNT(*) AS cnt FROM departments");

    let results = [];
    try {
      const [rows] = await pool.query(
        "SELECT gpa FROM results ORDER BY generated_at DESC LIMIT 500"
      );
      results = rows;
    } catch (_) {
      results = [];
    }

    res.json({
      ok: true,
      counts: {
        students:    studentsRow.cnt,
        faculty:     facultyRow.cnt,
        courses:     coursesRow.cnt,
        departments: departmentsRow.cnt
      },
      results
    });
  } catch (error) {
    console.error("overview-data error:", error.message);
    res.status(500).json({ ok: false, message: "Failed to load overview data.", error: error.message });
  }
});

// ─── DASHBOARD DATA ──────────────────────────────────────────
// Uses PL/SQL functions get_grade_letter() and calculate_gpa() inline in queries
app.get("/api/dashboard-data", async (req, res) => {
  try {
    const { search, departmentId } = req.query;

    let studentSql = `
      SELECT s.id AS student_id, s.roll_no, s.student_name,
             d.dept_name, sm.sem_number, s.batch,
             COALESCE(
               (SELECT GROUP_CONCAT(DISTINCT f2.faculty_name ORDER BY f2.faculty_name SEPARATOR ', ')
                FROM student_course_enrollment sce2
                JOIN course_faculty_mapping cfm2 ON cfm2.course_id = sce2.course_id
                JOIN faculty f2 ON f2.id = cfm2.faculty_id
                WHERE sce2.student_id = s.id),
               'Not assigned'
             ) AS assigned_faculty
      FROM students s
      JOIN departments d  ON s.dept_id = d.id
      JOIN semesters  sm  ON s.sem_id  = sm.id
      WHERE 1=1
    `;
    const studentParams = [];

    if (search) {
      studentSql += " AND (s.roll_no LIKE ? OR s.student_name LIKE ?)";
      studentParams.push(`%${search}%`, `%${search}%`);
    }
    if (departmentId) {
      studentSql += " AND s.dept_id = ?";
      studentParams.push(departmentId);
    }
    studentSql += " ORDER BY s.id";

    const [students] = await pool.query(studentSql, studentParams);

    const [faculty] = await pool.query(`
      SELECT f.id AS faculty_id, f.faculty_code, f.faculty_name,
             d.dept_name
      FROM faculty f
      JOIN departments d ON f.dept_id = d.id
      ORDER BY f.id
    `);

    const [courses] = await pool.query(`
      SELECT c.id AS course_id, c.course_code, c.course_name,
             c.credits, c.sem_id, sm.sem_number
      FROM courses c
      JOIN semesters sm ON c.sem_id = sm.id
      ORDER BY c.id
    `);

    const [departments] = await pool.query(
      "SELECT id AS dept_id, dept_code, dept_name FROM departments ORDER BY id"
    );

    const [semesters] = await pool.query(
      "SELECT id AS sem_id, sem_number, sem_name FROM semesters ORDER BY sem_number"
    );

    const [mappings] = await pool.query(`
      SELECT cfm.id AS mapping_id,
             f.id AS faculty_id, f.faculty_code, f.faculty_name,
             c.id AS course_id, c.course_code, c.course_name,
             d.id AS dept_id, d.dept_code, d.dept_name,
             sm.sem_number
      FROM course_faculty_mapping cfm
      JOIN faculty      f  ON cfm.faculty_id = f.id
      JOIN courses      c  ON cfm.course_id  = c.id
      JOIN departments  d  ON c.dept_id      = d.id
      JOIN semesters   sm  ON c.sem_id       = sm.id
      ORDER BY cfm.id
    `);

    const [departmentCourseMappings] = await pool.query(`
      SELECT c.id AS course_id, c.course_code, c.course_name,
             d.id AS dept_id, d.dept_code, d.dept_name
      FROM courses c
      JOIN departments d ON c.dept_id = d.id
      ORDER BY d.dept_code, c.course_code
    `);

    // ── Use PL/SQL function get_grade_letter() for grade calculation
    const [marks] = await pool.query(`
      SELECT m.id AS marks_id, s.roll_no, s.student_name,
             c.course_code, c.course_name,
             COALESCE(f.faculty_code, 'Unassigned') AS faculty_code,
             COALESCE(f.faculty_name, 'Unassigned') AS faculty_name,
             m.marks AS marks_obtained, m.max_marks,
             get_grade_letter(ROUND((m.marks / m.max_marks) * 100, 2)) AS grade,
             CASE
               WHEN m.marks >= 90 THEN 10
               WHEN m.marks >= 80 THEN 9
               WHEN m.marks >= 70 THEN 8
               WHEN m.marks >= 60 THEN 7
               WHEN m.marks >= 40 THEN 6
               ELSE 0
             END AS grade_point
      FROM marks m
      JOIN students s ON m.student_id = s.id
      JOIN courses  c ON m.course_id  = c.id
      LEFT JOIN course_faculty_mapping cfm ON cfm.course_id = c.id
      LEFT JOIN faculty f ON f.id = cfm.faculty_id
      ORDER BY m.id DESC
      LIMIT 200
    `);

    // LEFT JOIN so students without a generated result still appear (status = PENDING).
    // This allows admins to see who still needs result generation.
    const [results] = await pool.query(`
      SELECT r.id AS result_id, s.roll_no, s.student_name,
             sm.sem_number, r.gpa,
             COALESCE(r.pass_fail_status, 'PENDING') AS status
      FROM students s
      CROSS JOIN semesters sm
      LEFT JOIN results r ON r.student_id = s.id AND r.sem_id = sm.id
      WHERE EXISTS (
        SELECT 1 FROM marks m
        JOIN courses c ON m.course_id = c.id
        WHERE m.student_id = s.id AND c.sem_id = sm.id
      )
      ORDER BY r.id DESC, s.roll_no ASC, sm.sem_number ASC
      LIMIT 500
    `);

    const [activityLogs] = await pool.query(`
      SELECT al.id, f.faculty_code, f.faculty_name, s.roll_no,
             c.course_code, NULL AS old_marks, al.new_marks, al.action_time
      FROM activity_log al
      JOIN faculty f ON al.faculty_id = f.id
      JOIN students s ON al.student_id = s.id
      JOIN courses c ON al.course_id = c.id
      ORDER BY al.action_time DESC
      LIMIT 200
    `);

    res.json({
      ok: true,
      students,
      faculty,
      courses,
      departments,
      semesters,
      mappings,
      departmentCourseMappings,
      facultyCourseAssignments: mappings,
      assignments: mappings,
      marks,
      results,
      activityLogs
    });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Failed to load dashboard data.", error: error.message });
  }
});

// ─── LOOKUPS ─────────────────────────────────────────────────
app.get("/api/lookups", async (req, res) => {
  try {
    const [departments] = await pool.query(
      "SELECT id AS dept_id, dept_code, dept_name FROM departments ORDER BY dept_name"
    );
    const [semesters] = await pool.query(
      "SELECT id AS sem_id, sem_number, sem_name FROM semesters ORDER BY sem_number"
    );
    const [courses] = await pool.query(`
      SELECT c.id AS course_id, c.course_code, c.course_name,
             c.credits, c.sem_id, sm.sem_number
      FROM courses c
      JOIN semesters sm ON c.sem_id = sm.id
      ORDER BY c.course_code
    `);
    const [faculty] = await pool.query(
      "SELECT id AS faculty_id, faculty_code, faculty_name FROM faculty ORDER BY faculty_name"
    );
    const [students] = await pool.query(
      "SELECT id AS student_id, roll_no, student_name FROM students ORDER BY roll_no"
    );

    res.json({ ok: true, departments, semesters, courses, faculty, students });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Failed to load lookup data.", error: error.message });
  }
});

// ─── DEPARTMENTS ─────────────────────────────────────────────
app.get("/api/departments", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id AS dept_id, dept_code, dept_name FROM departments ORDER BY id"
    );
    res.json({ ok: true, departments: rows });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Failed to load departments.", error: error.message });
  }
});

app.post("/api/departments", async (req, res) => {
  const { deptCode, deptName } = req.body;
  if (!deptCode || !deptName) {
    return res.status(400).json({ ok: false, message: "Department code and name are required." });
  }
  try {
    const [result] = await pool.query(
      "INSERT INTO departments (dept_code, dept_name) VALUES (?, ?)",
      [deptCode.trim(), deptName.trim()]
    );
    res.json({ ok: true, deptId: result.insertId, message: "Department added." });
  } catch (error) {
    if (isDuplicateError(error)) {
      return res.status(409).json({ ok: false, message: "Department code or name already exists." });
    }
    res.status(500).json({ ok: false, message: "Failed to add department.", error: error.message });
  }
});

app.put("/api/departments/:id", async (req, res) => {
  const { deptCode, deptName } = req.body;
  if (!deptCode || !deptName) {
    return res.status(400).json({ ok: false, message: "Department code and name are required." });
  }
  try {
    const [result] = await pool.query(
      "UPDATE departments SET dept_code = ?, dept_name = ? WHERE id = ?",
      [deptCode.trim(), deptName.trim(), req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, message: "No department found with ID " + req.params.id });
    }
    res.json({ ok: true, message: "Department updated." });
  } catch (error) {
    if (isDuplicateError(error)) {
      return res.status(409).json({ ok: false, message: "Department code or name already exists." });
    }
    res.status(500).json({ ok: false, message: "Failed to update department.", error: error.message });
  }
});

app.delete("/api/departments/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM departments WHERE id = ?", [req.params.id]);
    res.json({ ok: true, message: "Department deleted." });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Failed to delete department.", error: error.message });
  }
});

// ─── SEMESTERS ───────────────────────────────────────────────
app.get("/api/semesters", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id AS sem_id, sem_number, sem_name FROM semesters ORDER BY sem_number"
    );
    res.json({ ok: true, semesters: rows });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Failed to load semesters.", error: error.message });
  }
});

app.post("/api/semesters", async (req, res) => {
  const { semNumber, semName } = req.body;
  if (!semNumber || !semName) {
    return res.status(400).json({ ok: false, message: "Semester number and name are required." });
  }
  try {
    const [result] = await pool.query(
      "INSERT INTO semesters (sem_number, sem_name) VALUES (?, ?)",
      [semNumber, semName.trim()]
    );
    res.json({ ok: true, semId: result.insertId, message: "Semester added." });
  } catch (error) {
    if (isDuplicateError(error)) {
      return res.status(409).json({ ok: false, message: "Semester already exists." });
    }
    res.status(500).json({ ok: false, message: "Failed to add semester.", error: error.message });
  }
});

app.put("/api/semesters/:id", async (req, res) => {
  const { semNumber, semName } = req.body;
  try {
    await pool.query(
      "UPDATE semesters SET sem_number = ?, sem_name = ? WHERE id = ?",
      [semNumber, semName.trim(), req.params.id]
    );
    res.json({ ok: true, message: "Semester updated." });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Failed to update semester.", error: error.message });
  }
});

app.delete("/api/semesters/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM semesters WHERE id = ?", [req.params.id]);
    res.json({ ok: true, message: "Semester deleted." });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Failed to delete semester.", error: error.message });
  }
});

// ─── COURSES ─────────────────────────────────────────────────
app.get("/api/courses", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT c.id AS course_id, c.course_code, c.course_name,
             c.credits, sm.sem_number, d.dept_name
      FROM courses c
      JOIN semesters sm  ON c.sem_id  = sm.id
      JOIN departments d ON c.dept_id = d.id
      ORDER BY c.id
    `);
    res.json({ ok: true, courses: rows });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Failed to load courses.", error: error.message });
  }
});

app.post("/api/courses", async (req, res) => {
  const { courseCode, courseName, credits, semId, deptId } = req.body;
  if (!courseCode || !courseName || !credits || !semId || !deptId) {
    return res.status(400).json({ ok: false, message: "All course fields are required." });
  }
  try {
    const [result] = await pool.query(
      "INSERT INTO courses (course_code, course_name, credits, sem_id, dept_id) VALUES (?, ?, ?, ?, ?)",
      [courseCode.trim(), courseName.trim(), credits, semId, deptId]
    );
    res.json({ ok: true, courseId: result.insertId, message: "Course added." });
  } catch (error) {
    if (isDuplicateError(error)) {
      return res.status(409).json({ ok: false, message: "Course code already exists." });
    }
    res.status(500).json({ ok: false, message: "Failed to add course.", error: error.message });
  }
});

app.put("/api/courses/:id", async (req, res) => {
  const { courseCode, courseName, credits, semId, deptId } = req.body;
  try {
    await pool.query(
      "UPDATE courses SET course_code = ?, course_name = ?, credits = ?, sem_id = ?, dept_id = ? WHERE id = ?",
      [courseCode.trim(), courseName.trim(), credits, semId, deptId, req.params.id]
    );
    res.json({ ok: true, message: "Course updated." });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Failed to update course.", error: error.message });
  }
});

app.delete("/api/courses/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM courses WHERE id = ?", [req.params.id]);
    res.json({ ok: true, message: "Course deleted." });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Failed to delete course.", error: error.message });
  }
});

// ─── STUDENTS ────────────────────────────────────────────────
// Uses PL/SQL: sp_enroll_student — validates dept/sem, inserts, returns new ID
app.post("/api/students", async (req, res) => {
  const { rollNo, studentName, email, deptId, semId, batch, password } = req.body;

  if (!rollNo || !studentName || !password) {
    return res.status(400).json({ ok: false, message: "Roll no, name, and password are required." });
  }

  try {
    // Look up dept_code and sem_number from IDs (sp_enroll_student uses codes, not IDs)
    const [[dept]] = await pool.query("SELECT dept_code FROM departments WHERE id = ?", [deptId]);
    const [[sem]]  = await pool.query("SELECT sem_number FROM semesters WHERE id = ?", [semId]);

    if (!dept) return res.status(400).json({ ok: false, message: "Invalid department." });
    if (!sem)  return res.status(400).json({ ok: false, message: "Invalid semester." });

    // CALL sp_enroll_student — the procedure handles validation and insert
    await pool.query(
      `CALL sp_enroll_student(?, ?, ?, ?, ?, ?, ?, ?, @new_id)`,
      [rollNo, studentName, email || null, password, hashPassword(password),
       dept.dept_code, sem.sem_number, batch || ""]
    );

    const [[{ new_id }]] = await pool.query("SELECT @new_id AS new_id");
    res.json({ ok: true, studentId: new_id, message: "Student added." });
  } catch (error) {
    if (isDuplicateError(error)) {
      return res.status(409).json({ ok: false, message: "A student with this roll number or email already exists." });
    }
    res.status(500).json({ ok: false, message: error.message || "Failed to add student." });
  }
});

app.put("/api/students/:id", async (req, res) => {
  const { rollNo, studentName, email, deptId, semId, batch, password } = req.body;

  try {
    let sql = `UPDATE students SET roll_no = ?, student_name = ?, email = ?,
               dept_id = ?, sem_id = ?, batch = ?`;
    const params = [rollNo, studentName, email || null, deptId, semId, batch || ""];

    if (password) {
      sql += ", password = ?, password_hash = ?";
      params.push(password, hashPassword(password));
    }

    sql += " WHERE id = ?";
    params.push(req.params.id);

    await pool.query(sql, params);
    res.json({ ok: true, message: "Student updated." });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Failed to update student.", error: error.message });
  }
});

app.delete("/api/students/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM students WHERE id = ?", [req.params.id]);
    res.json({ ok: true, message: "Student deleted." });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Failed to delete student.", error: error.message });
  }
});

// Student profile — uses sp_get_student_transcript for marks/grades
app.get("/api/student/:rollNo", async (req, res) => {
  try {
    const [studentRows] = await pool.query(
      `SELECT s.id, s.roll_no, s.student_name, s.email, s.batch,
              d.dept_name, sm.sem_number
       FROM students s
       JOIN departments d ON s.dept_id = d.id
       JOIN semesters sm  ON s.sem_id  = sm.id
       WHERE s.roll_no = ?`,
      [req.params.rollNo]
    );

    if (!studentRows.length) {
      return res.status(404).json({ ok: false, message: "Student not found." });
    }

    const student = studentRows[0];

    const [results] = await pool.query(
      `SELECT r.id, r.gpa, r.pass_fail_status, sm.sem_number
       FROM results r
       JOIN semesters sm ON r.sem_id = sm.id
       WHERE r.student_id = ?
       ORDER BY sm.sem_number`,
      [student.id]
    );

    // ── Use PL/SQL: sp_get_student_transcript for full marks with grades
    await pool.query("CALL sp_get_student_transcript(?)", [student.id]);
    const [transcriptRows] = await pool.query("CALL sp_get_student_transcript(?)", [student.id]);
    // mysql2 returns [resultSet, okPacket] for CALL; transcriptRows[0] is the actual rows
    const marks = Array.isArray(transcriptRows[0]) ? transcriptRows[0] : transcriptRows;

    res.json({ ok: true, student, results, marks });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Failed to load student profile.", error: error.message });
  }
});

// ─── FACULTY ─────────────────────────────────────────────────
// Uses PL/SQL: sp_add_faculty — validates dept, inserts, returns new ID
app.post("/api/faculty", async (req, res) => {
  const { facultyCode, facultyName, email, deptId, password } = req.body;

  if (!facultyCode || !facultyName || !password) {
    return res.status(400).json({ ok: false, message: "Faculty code, name, and password are required." });
  }

  try {
    const [[dept]] = await pool.query("SELECT dept_code FROM departments WHERE id = ?", [deptId]);
    if (!dept) return res.status(400).json({ ok: false, message: "Invalid department." });

    // CALL sp_add_faculty — validates dept and inserts
    await pool.query(
      `CALL sp_add_faculty(?, ?, ?, ?, ?, ?, @new_id)`,
      [facultyCode, facultyName, email || null, password, hashPassword(password), dept.dept_code]
    );

    const [[{ new_id }]] = await pool.query("SELECT @new_id AS new_id");
    res.json({ ok: true, facultyId: new_id, message: "Faculty added." });
  } catch (error) {
    if (isDuplicateError(error)) {
      return res.status(409).json({ ok: false, message: "Faculty with this code or email already exists." });
    }
    res.status(500).json({ ok: false, message: error.message || "Failed to add faculty." });
  }
});

app.put("/api/faculty/:id", async (req, res) => {
  const { facultyCode, facultyName, email, deptId, password } = req.body;

  try {
    let sql = `UPDATE faculty SET faculty_code = ?, faculty_name = ?, email = ?, dept_id = ?`;
    const params = [facultyCode, facultyName, email || null, deptId];

    if (password) {
      sql += ", password = ?, password_hash = ?";
      params.push(password, hashPassword(password));
    }

    sql += " WHERE id = ?";
    params.push(req.params.id);

    await pool.query(sql, params);
    res.json({ ok: true, message: "Faculty updated." });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Failed to update faculty.", error: error.message });
  }
});

app.delete("/api/faculty/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM faculty WHERE id = ?", [req.params.id]);
    res.json({ ok: true, message: "Faculty deleted." });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Failed to delete faculty.", error: error.message });
  }
});

// Faculty profile
app.get("/api/faculty/:facultyCode", async (req, res) => {
  try {
    const [facultyRows] = await pool.query(
      `SELECT f.id, f.faculty_code, f.faculty_name, f.email, d.dept_name
       FROM faculty f
       JOIN departments d ON f.dept_id = d.id
       WHERE f.faculty_code = ?`,
      [req.params.facultyCode]
    );

    if (!facultyRows.length) {
      return res.status(404).json({ ok: false, message: "Faculty not found." });
    }

    const faculty = facultyRows[0];

    const [courses] = await pool.query(
      `SELECT DISTINCT c.id AS course_id, c.course_code, c.course_name,
              d.dept_name, sm.sem_number
       FROM course_faculty_mapping cfm
       JOIN courses   c  ON cfm.course_id  = c.id
       JOIN departments d ON c.dept_id = d.id
       JOIN semesters sm ON c.sem_id       = sm.id
       WHERE cfm.faculty_id = ?`,
      [faculty.id]
    );

    const [students] = await pool.query(
      `SELECT DISTINCT s.roll_no, s.student_name, d.dept_name, sm.sem_number, s.batch
       FROM course_faculty_mapping cfm
       JOIN courses c ON cfm.course_id = c.id
       JOIN students s ON s.dept_id = c.dept_id AND s.sem_id = c.sem_id
       JOIN departments d ON s.dept_id = d.id
       JOIN semesters sm ON s.sem_id = sm.id
       WHERE cfm.faculty_id = ?
       ORDER BY s.roll_no`,
      [faculty.id]
    );

    // ── Use PL/SQL function get_grade_letter() for grade column
    const [studentMarks] = await pool.query(
      `SELECT s.roll_no, s.student_name,
              c.id AS course_id, c.course_code, c.course_name,
              m.id AS marks_id, m.marks, m.max_marks, m.updated_at,
              get_grade_letter(ROUND((m.marks / m.max_marks) * 100, 2)) AS grade
       FROM course_faculty_mapping cfm
       JOIN courses c ON cfm.course_id = c.id
       JOIN students s ON s.dept_id = c.dept_id AND s.sem_id = c.sem_id
       LEFT JOIN marks m ON m.student_id = s.id AND m.course_id = c.id
       WHERE cfm.faculty_id = ?
       ORDER BY s.roll_no, c.course_code`,
      [faculty.id]
    );

    res.json({ ok: true, faculty, courses, students, studentMarks });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Failed to load faculty profile.", error: error.message });
  }
});

// Faculty marks entry
// Uses PL/SQL: sp_update_marks — authorization check + save + auto-log + auto-result
app.post("/api/faculty/:facultyCode/marks", async (req, res) => {
  const { rollNo, courseId, marksObtained } = req.body;
  const marksValue = Number(marksObtained);

  if (!rollNo || !courseId || marksObtained === undefined) {
    return res.status(400).json({ ok: false, message: "Student, course, and marks are required." });
  }
  if (!Number.isFinite(marksValue) || marksValue < 0 || marksValue > 100) {
    return res.status(400).json({ ok: false, message: "Marks must be between 0 and 100." });
  }

  try {
    // Look up faculty ID and student ID for sp_update_marks
    const [[faculty]] = await pool.query(
      "SELECT id AS faculty_id FROM faculty WHERE faculty_code = ? LIMIT 1",
      [req.params.facultyCode]
    );
    if (!faculty) {
      return res.status(404).json({ ok: false, message: "Faculty not found." });
    }

    const [[student]] = await pool.query(
      "SELECT id AS student_id FROM students WHERE roll_no = ? LIMIT 1",
      [rollNo]
    );
    if (!student) {
      return res.status(404).json({ ok: false, message: "Student not found." });
    }

    // CALL sp_update_marks:
    //   • Checks faculty is authorised for this course
    //   • Inserts or updates marks
    //   • Logs to activity_log
    //   • Calls sp_calculate_and_store_result automatically
    await pool.query(
      "CALL sp_update_marks(?, ?, ?, ?)",
      [faculty.faculty_id, student.student_id, courseId, marksValue]
    );

    res.json({ ok: true, message: "Marks saved." });
  } catch (error) {
    // PL/SQL SIGNAL errors arrive as ER_SIGNAL_EXCEPTION
    if (error.code === "ER_SIGNAL_EXCEPTION") {
      return res.status(403).json({ ok: false, message: error.message });
    }
    res.status(500).json({ ok: false, message: "Failed to save marks.", error: error.message });
  }
});

// ─── DELETE STUDENT BY FACULTY ───────────────────────────────
app.delete("/api/faculty/:facultyCode/students/:rollNo", async (req, res) => {
  try {
    const [[student]] = await pool.query(
      `SELECT DISTINCT s.id, s.roll_no
       FROM faculty f
       JOIN course_faculty_mapping cfm ON cfm.faculty_id = f.id
       JOIN courses c ON cfm.course_id = c.id
       JOIN students s ON s.dept_id = c.dept_id AND s.sem_id = c.sem_id
       WHERE f.faculty_code = ?
         AND s.roll_no = ?
       LIMIT 1`,
      [req.params.facultyCode, req.params.rollNo]
    );

    if (!student) {
      return res.status(403).json({
        ok: false,
        message: "This student is not related to this faculty's assigned courses."
      });
    }

    await pool.query("DELETE FROM students WHERE id = ?", [student.id]);
    res.json({ ok: true, message: "Student record deleted." });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Failed to delete student.", error: error.message });
  }
});

// ─── COURSE-FACULTY MAPPINGS ──────────────────────────────────
app.get("/api/mappings", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT cfm.id AS mapping_id, f.faculty_name, c.course_name,
             d.dept_name, sm.sem_number
      FROM course_faculty_mapping cfm
      JOIN faculty     f  ON cfm.faculty_id = f.id
      JOIN courses     c  ON cfm.course_id  = c.id
      JOIN departments d  ON c.dept_id      = d.id
      JOIN semesters  sm  ON c.sem_id       = sm.id
      ORDER BY cfm.id
    `);
    res.json({ ok: true, mappings: rows });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Failed to load mappings.", error: error.message });
  }
});

app.post("/api/mappings", async (req, res) => {
  const { courseId, facultyId } = req.body;
  if (!courseId || !facultyId) {
    return res.status(400).json({ ok: false, message: "Course and faculty are required." });
  }
  try {
    const [result] = await pool.query(
      "INSERT INTO course_faculty_mapping (course_id, faculty_id) VALUES (?, ?)",
      [courseId, facultyId]
    );
    res.json({ ok: true, mappingId: result.insertId, message: "Mapping added." });
  } catch (error) {
    if (isDuplicateError(error)) {
      return res.status(409).json({ ok: false, message: "This mapping already exists." });
    }
    res.status(500).json({ ok: false, message: "Failed to add mapping.", error: error.message });
  }
});

app.delete("/api/mappings/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM course_faculty_mapping WHERE id = ?", [req.params.id]);
    res.json({ ok: true, message: "Mapping deleted." });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Failed to delete mapping.", error: error.message });
  }
});

app.post("/api/department-course-mappings", async (req, res) => {
  const { deptId, courseId } = req.body;
  if (!deptId || !courseId) {
    return res.status(400).json({ ok: false, message: "Department and course are required." });
  }
  try {
    await pool.query("UPDATE courses SET dept_id = ? WHERE id = ?", [deptId, courseId]);
    res.json({ ok: true, message: "Department-course mapping saved." });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Failed to save department-course mapping.", error: error.message });
  }
});

app.post("/api/faculty-course-assignments", async (req, res) => {
  const { facultyId, courseId } = req.body;
  if (!facultyId || !courseId) {
    return res.status(400).json({ ok: false, message: "Faculty and course are required." });
  }
  try {
    const [result] = await pool.query(
      "INSERT INTO course_faculty_mapping (course_id, faculty_id) VALUES (?, ?)",
      [courseId, facultyId]
    );
    res.json({ ok: true, assignmentId: result.insertId, message: "Faculty-course assignment saved." });
  } catch (error) {
    if (isDuplicateError(error)) {
      return res.status(409).json({ ok: false, message: "This faculty-course assignment already exists." });
    }
    res.status(500).json({ ok: false, message: "Failed to save faculty-course assignment.", error: error.message });
  }
});

app.post("/api/assignments", async (req, res) => {
  const { facultyId, courseId } = req.body;
  if (!facultyId || !courseId) {
    return res.status(400).json({ ok: false, message: "Faculty and course are required." });
  }
  try {
    const [result] = await pool.query(
      "INSERT INTO course_faculty_mapping (course_id, faculty_id) VALUES (?, ?)",
      [courseId, facultyId]
    );
    res.json({ ok: true, assignmentId: result.insertId, message: "Assignment added." });
  } catch (error) {
    if (isDuplicateError(error)) {
      return res.status(409).json({ ok: false, message: "This assignment already exists." });
    }
    res.status(500).json({ ok: false, message: "Failed to add assignment.", error: error.message });
  }
});

app.delete("/api/assignments/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM course_faculty_mapping WHERE id = ?", [req.params.id]);
    res.json({ ok: true, message: "Assignment deleted." });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Failed to delete assignment.", error: error.message });
  }
});

// ─── MARKS ───────────────────────────────────────────────────
// Uses PL/SQL: sp_update_marks — authorization + save + auto-log + auto-result
// The triggers trg_after_marks_insert / trg_after_marks_update also fire
// automatically to recalculate results.
app.post("/api/marks", async (req, res) => {
  const { studentId, rollNo, courseId, facultyId, marksObtained } = req.body;
  if ((!studentId && !rollNo) || !courseId || marksObtained === undefined) {
    return res.status(400).json({ ok: false, message: "Student, course, and marks are required." });
  }

  try {
    let resolvedStudentId = studentId;
    if (!resolvedStudentId && rollNo) {
      const [[student]] = await pool.query("SELECT id FROM students WHERE roll_no = ?", [rollNo]);
      if (!student) return res.status(404).json({ ok: false, message: "Student roll number not found." });
      resolvedStudentId = student.id;
    }

    // Admin marks entry — always use direct INSERT/UPDATE (no faculty auth check).
    // sp_update_marks enforces course-faculty mapping which is only for faculty portal.
    // Triggers trg_after_marks_insert / trg_after_marks_update fire automatically
    // to recalculate the student's result.
    const [result] = await pool.query(
      "INSERT INTO marks (student_id, course_id, marks) VALUES (?, ?, ?)" +
      " ON DUPLICATE KEY UPDATE marks = VALUES(marks)",
      [resolvedStudentId, courseId, Number(marksObtained)]
    );
    res.json({ ok: true, marksId: result.insertId || null, message: "Marks added." });
  } catch (error) {
    if (isDuplicateError(error)) {
      return res.status(409).json({ ok: false, message: "Marks for this student and course already exist." });
    }
    if (error.code === "ER_SIGNAL_EXCEPTION") {
      return res.status(403).json({ ok: false, message: error.message });
    }
    res.status(500).json({ ok: false, message: "Failed to add marks.", error: error.message });
  }
});

app.put("/api/marks/:id", async (req, res) => {
  const { marksObtained } = req.body;
  try {
    // Admin update — always use direct UPDATE (no faculty auth check).
    // sp_update_marks enforces course-faculty mapping which is only for faculty portal.
    await pool.query("UPDATE marks SET marks = ? WHERE id = ?", [Number(marksObtained), req.params.id]);
    // trg_after_marks_update fires automatically — recalculates result

    res.json({ ok: true, message: "Marks updated." });
  } catch (error) {
    if (error.code === "ER_SIGNAL_EXCEPTION") {
      return res.status(403).json({ ok: false, message: error.message });
    }
    res.status(500).json({ ok: false, message: "Failed to update marks.", error: error.message });
  }
});

app.delete("/api/marks/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM marks WHERE id = ?", [req.params.id]);
    res.json({ ok: true, message: "Marks deleted." });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Failed to delete marks.", error: error.message });
  }
});

// ─── RESULTS ─────────────────────────────────────────────────
// Uses PL/SQL: sp_calculate_and_store_result — replaces all JS GPA/status logic
app.post("/api/results/generate", async (req, res) => {
  const { studentId, rollNo, semId } = req.body;

  if ((!studentId && !rollNo) || !semId) {
    return res.status(400).json({ ok: false, message: "Student and semester are required." });
  }

  try {
    let resolvedStudentId = studentId;

    if (!resolvedStudentId && rollNo) {
      const [[student]] = await pool.query("SELECT id FROM students WHERE roll_no = ?", [rollNo]);
      if (!student) return res.status(404).json({ ok: false, message: "Student not found." });
      resolvedStudentId = student.id;
    }

    // CALL sp_calculate_and_store_result:
    //   • Calls calculate_gpa() and get_pass_fail() internally
    //   • Inserts/updates the results table
    //   • Updates student_cgpa table
    await pool.query(
      "CALL sp_calculate_and_store_result(?, ?)",
      [resolvedStudentId, semId]
    );

    // Fetch the generated result to return to client
    const [[result]] = await pool.query(
      "SELECT gpa, pass_fail_status AS status FROM results WHERE student_id = ? AND sem_id = ?",
      [resolvedStudentId, semId]
    );

    res.json({ ok: true, message: "Result generated.", gpa: result?.gpa, status: result?.status });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Failed to generate result.", error: error.message });
  }
});

// ── Recalculate ALL results at once (uses sp_recalculate_all_results)
app.post("/api/results/recalculate-all", async (req, res) => {
  try {
    await pool.query("CALL sp_recalculate_all_results()");
    res.json({ ok: true, message: "All results recalculated successfully." });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Failed to recalculate results.", error: error.message });
  }
});

app.delete("/api/results/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM results WHERE id = ?", [req.params.id]);
    res.json({ ok: true, message: "Result deleted." });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Failed to delete result.", error: error.message });
  }
});

// ─── DEPARTMENT PERFORMANCE REPORT ───────────────────────────
// Uses PL/SQL: sp_department_performance_report
app.get("/api/departments/:id/report", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "CALL sp_department_performance_report(?)",
      [req.params.id]
    );
    // mysql2 CALL returns [resultRows, okPacket]; rows[0] is the result set
    res.json({ ok: true, report: Array.isArray(rows[0]) ? rows[0] : rows });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Failed to load department report.", error: error.message });
  }
});

// ─── CGPA ────────────────────────────────────────────────────
// CGPA is now maintained automatically by sp_calculate_and_store_result.
// This endpoint is kept for manual overrides only.
app.post("/api/cgpa", async (req, res) => {
  const { studentRoll, cgpa } = req.body;
  if (!studentRoll || cgpa === undefined) {
    return res.status(400).json({ ok: false, message: "Student roll and CGPA are required." });
  }
  try {
    const [[student]] = await pool.query("SELECT id FROM students WHERE roll_no = ?", [studentRoll]);
    if (!student) return res.status(404).json({ ok: false, message: "Student not found." });

    await pool.query(
      `INSERT INTO student_cgpa (student_id, cgpa)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE cgpa = VALUES(cgpa)`,
      [student.id, cgpa]
    );
    res.json({ ok: true, message: "CGPA saved." });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Failed to save CGPA.", error: error.message });
  }
});

// ─── FACULTY-STUDENT ADVISOR MAPPINGS ────────────────────────
// GET — list all faculty-student advisor assignments
app.get("/api/faculty-student-mappings", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT fsm.id, fsm.faculty_id, fsm.student_id,
             f.faculty_code, f.faculty_name,
             s.roll_no, s.student_name
      FROM faculty_student_mapping fsm
      JOIN faculty  f ON fsm.faculty_id = f.id
      JOIN students s ON fsm.student_id = s.id
      ORDER BY s.roll_no
    `);
    res.json({ ok: true, mappings: rows });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Failed to load faculty-student mappings.", error: error.message });
  }
});

// POST — assign a faculty as advisor for a student
app.post("/api/faculty-student-mappings", async (req, res) => {
  const { facultyId, studentId } = req.body;
  if (!facultyId || !studentId) {
    return res.status(400).json({ ok: false, message: "Faculty ID and Student ID are required." });
  }
  try {
    const [[faculty]] = await pool.query("SELECT id FROM faculty WHERE id = ?", [facultyId]);
    if (!faculty) return res.status(404).json({ ok: false, message: "Faculty not found." });

    const [[student]] = await pool.query("SELECT id FROM students WHERE id = ?", [studentId]);
    if (!student) return res.status(404).json({ ok: false, message: "Student not found." });

    const [result] = await pool.query(
      `INSERT INTO faculty_student_mapping (faculty_id, student_id)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE faculty_id = VALUES(faculty_id)`,
      [facultyId, studentId]
    );
    res.json({ ok: true, message: "Advisor assignment saved.", id: result.insertId });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Failed to save advisor assignment.", error: error.message });
  }
});

// DELETE — remove a faculty-student advisor assignment by mapping ID
app.delete("/api/faculty-student-mappings/:id", async (req, res) => {
  try {
    const [result] = await pool.query(
      "DELETE FROM faculty_student_mapping WHERE id = ?",
      [req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, message: "Mapping not found." });
    }
    res.json({ ok: true, message: "Advisor assignment removed." });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Failed to remove advisor assignment.", error: error.message });
  }
});

// ─── STUDENT COURSE ENROLLMENT ───────────────────────────────
// GET — get enrolled courses for a student
app.get("/api/student-enrollments/:studentId", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT sce.id, sce.course_id, c.course_code, c.course_name,
             c.credits, sm.sem_number,
             COALESCE(GROUP_CONCAT(DISTINCT f.faculty_name ORDER BY f.faculty_name SEPARATOR ', '), 'Not assigned') AS faculty_names
      FROM student_course_enrollment sce
      JOIN courses c ON sce.course_id = c.id
      JOIN semesters sm ON c.sem_id = sm.id
      LEFT JOIN course_faculty_mapping cfm ON cfm.course_id = c.id
      LEFT JOIN faculty f ON f.id = cfm.faculty_id
      WHERE sce.student_id = ?
      GROUP BY sce.id, sce.course_id, c.course_code, c.course_name, c.credits, sm.sem_number
      ORDER BY sm.sem_number, c.course_code
    `, [req.params.studentId]);
    res.json({ ok: true, enrollments: rows });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Failed to load enrollments.", error: error.message });
  }
});

// GET — get all enrollments (for admin overview)
app.get("/api/student-enrollments", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT sce.id, s.id AS student_id, s.roll_no, s.student_name,
             c.id AS course_id, c.course_code, c.course_name,
             sm.id AS sem_id, sm.sem_number,
             COALESCE(GROUP_CONCAT(DISTINCT f.faculty_name ORDER BY f.faculty_name SEPARATOR ', '), 'Not assigned') AS faculty_names
      FROM student_course_enrollment sce
      JOIN students s ON sce.student_id = s.id
      JOIN courses c ON sce.course_id = c.id
      JOIN semesters sm ON c.sem_id = sm.id
      LEFT JOIN course_faculty_mapping cfm ON cfm.course_id = c.id
      LEFT JOIN faculty f ON f.id = cfm.faculty_id
      GROUP BY sce.id, s.id, s.roll_no, s.student_name, c.id, c.course_code, c.course_name, sm.id, sm.sem_number
      ORDER BY s.roll_no, sm.sem_number, c.course_code
    `);
    res.json({ ok: true, enrollments: rows });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Failed to load enrollments.", error: error.message });
  }
});

// POST — enroll a student in a course
app.post("/api/student-enrollments", async (req, res) => {
  const { studentId, courseId } = req.body;
  if (!studentId || !courseId) {
    return res.status(400).json({ ok: false, message: "Student ID and Course ID are required." });
  }
  try {
    const [[student]] = await pool.query("SELECT id FROM students WHERE id = ?", [studentId]);
    if (!student) return res.status(404).json({ ok: false, message: "Student not found." });
    const [[course]] = await pool.query("SELECT id FROM courses WHERE id = ?", [courseId]);
    if (!course) return res.status(404).json({ ok: false, message: "Course not found." });

    const [result] = await pool.query(
      `INSERT IGNORE INTO student_course_enrollment (student_id, course_id) VALUES (?, ?)`,
      [studentId, courseId]
    );
    if (result.affectedRows === 0) {
      return res.status(409).json({ ok: false, message: "Student is already enrolled in this course." });
    }
    res.json({ ok: true, message: "Student enrolled in course.", id: result.insertId });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Failed to enroll student.", error: error.message });
  }
});

// DELETE — remove a student enrollment by enrollment ID
app.delete("/api/student-enrollments/:id", async (req, res) => {
  try {
    const [result] = await pool.query(
      "DELETE FROM student_course_enrollment WHERE id = ?",
      [req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, message: "Enrollment not found." });
    }
    res.json({ ok: true, message: "Enrollment removed." });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Failed to remove enrollment.", error: error.message });
  }
});

// ─── STATIC FALLBACK ─────────────────────────────────────────
app.get("*", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

// ─── START SERVER ────────────────────────────────────────────
app.listen(port, "0.0.0.0", () => {
  console.log(`Server running at http://0.0.0.0:${port}`);
});