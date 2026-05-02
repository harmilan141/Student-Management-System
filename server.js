// ────────────────────────────────────────────────────────────────
//  server.js  — Student Management System
//  Fixed to match actual database schema (database.sql)
//  Real column names: id (not dept_id/student_id etc.), 
//  marks (not marks_obtained), results (not semester_results),
//  course_faculty_mapping (not faculty_course_assignment/department_course_mapping)
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

// ─── HELPERS ─────────────────────────────────────────────────
function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function isDuplicateError(error) {
  return error && error.code === "ER_DUP_ENTRY";
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
// DB schema: admins(id, name, email, password, admin_username, password_hash)
//            students(id, roll_no, student_name, email, password, ...)
//            faculty(id, faculty_code, faculty_name, email, password, ...)
app.post("/api/login", async (req, res) => {
  const { userId, password, role } = req.body;

  if (!userId || !password || !role) {
    return res.status(400).json({ ok: false, message: "User ID, password, and role are required." });
  }

  const queries = {
    admin: {
      sql: `SELECT id AS admin_id, admin_username AS user_id, name AS full_name, email, 'admin' AS role
            FROM admins
            WHERE admin_username = ? AND password_hash = ?
            LIMIT 1`
    },
    student: {
      sql: `SELECT id AS student_id, roll_no AS user_id, student_name AS full_name, email, 'student' AS role
            FROM students
            WHERE roll_no = ? AND password_hash = ?
            LIMIT 1`
    },
    faculty: {
      sql: `SELECT id AS faculty_id, faculty_code AS user_id, faculty_name AS full_name, email, 'faculty' AS role
            FROM faculty
            WHERE faculty_code = ? AND password_hash = ?
            LIMIT 1`
    }
  };

  const config = queries[role];
  if (!config) {
    return res.status(400).json({ ok: false, message: "Invalid role selected." });
  }

  try {
    const [rows] = await pool.query(config.sql, [userId, hashPassword(password)]);

    if (rows.length === 0) {
      return res.status(401).json({ ok: false, message: "Invalid credentials or role." });
    }

    res.json({ ok: true, user: rows[0] });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Unable to log in.", error: error.message });
  }
});

// ─── OVERVIEW DATA ───────────────────────────────────────────
// Table name is "results" not "semester_results"; gpa column exists
app.get("/api/overview-data", async (req, res) => {
  try {
    const [[studentsRow]]    = await pool.query("SELECT COUNT(*) AS cnt FROM students");
    const [[facultyRow]]     = await pool.query("SELECT COUNT(*) AS cnt FROM faculty");
    const [[coursesRow]]     = await pool.query("SELECT COUNT(*) AS cnt FROM courses");
    const [[departmentsRow]] = await pool.query("SELECT COUNT(*) AS cnt FROM departments");

    const [results] = await pool.query(
      "SELECT gpa FROM results ORDER BY generated_at DESC LIMIT 500"
    );

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
    res.status(500).json({ ok: false, message: "Failed to load overview data.", error: error.message });
  }
});

// ─── DASHBOARD DATA ──────────────────────────────────────────
// All PKs are "id"; joined tables use dept_id, sem_id etc as FK
// No department_course_mapping or faculty_course_assignment tables
// Use course_faculty_mapping instead
app.get("/api/dashboard-data", async (req, res) => {
  try {
    const { search, departmentId } = req.query;

    // Students
    let studentSql = `
      SELECT s.id AS student_id, s.roll_no, s.student_name,
             d.dept_name, sm.sem_number, s.batch,
             COALESCE(f.faculty_name, 'Not assigned') AS assigned_faculty
      FROM students s
      JOIN departments d  ON s.dept_id = d.id
      JOIN semesters  sm  ON s.sem_id  = sm.id
      LEFT JOIN course_faculty_mapping cfm ON cfm.course_id IN (
        SELECT id FROM courses WHERE dept_id = s.dept_id AND sem_id = s.sem_id LIMIT 1
      )
      LEFT JOIN faculty f ON cfm.faculty_id = f.id
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
    studentSql += " GROUP BY s.id ORDER BY s.id";

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
             c.credits, sm.sem_number
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

    // course_faculty_mapping is the only mapping table
    const [mappings] = await pool.query(`
      SELECT cfm.id AS mapping_id, f.faculty_name, c.course_name,
             d.dept_name, sm.sem_number
      FROM course_faculty_mapping cfm
      JOIN faculty      f  ON cfm.faculty_id = f.id
      JOIN courses      c  ON cfm.course_id  = c.id
      JOIN departments  d  ON c.dept_id      = d.id
      JOIN semesters   sm  ON c.sem_id       = sm.id
      ORDER BY cfm.id
    `);

    const [marks] = await pool.query(`
      SELECT m.id AS marks_id, s.roll_no, s.student_name,
             c.course_name, m.marks AS marks_obtained, m.max_marks
      FROM marks m
      JOIN students s ON m.student_id = s.id
      JOIN courses  c ON m.course_id  = c.id
      ORDER BY m.id DESC
      LIMIT 200
    `);

    const [results] = await pool.query(`
      SELECT r.id AS result_id, s.roll_no, s.student_name,
             sm.sem_number, r.gpa, r.pass_fail_status AS status
      FROM results r
      JOIN students  s  ON r.student_id = s.id
      JOIN semesters sm ON r.sem_id     = sm.id
      ORDER BY r.id DESC
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
      assignments: mappings, // alias for frontend compatibility
      marks,
      results
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
             c.credits, sm.sem_number
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
  try {
    await pool.query(
      "UPDATE departments SET dept_code = ?, dept_name = ? WHERE id = ?",
      [deptCode.trim(), deptName.trim(), req.params.id]
    );
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
app.post("/api/students", async (req, res) => {
  const { rollNo, studentName, email, deptId, semId, batch, password } = req.body;

  if (!rollNo || !studentName || !password) {
    return res.status(400).json({ ok: false, message: "Roll no, name, and password are required." });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO students (roll_no, student_name, email, password, password_hash, dept_id, sem_id, batch)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [rollNo, studentName, email || null, password, hashPassword(password), deptId, semId, batch || '']
    );
    res.json({ ok: true, studentId: result.insertId, message: "Student added." });
  } catch (error) {
    if (isDuplicateError(error)) {
      return res.status(409).json({ ok: false, message: "A student with this roll number or email already exists." });
    }
    res.status(500).json({ ok: false, message: "Failed to add student.", error: error.message });
  }
});

app.put("/api/students/:id", async (req, res) => {
  const { rollNo, studentName, email, deptId, semId, batch, password } = req.body;

  try {
    let sql = `UPDATE students SET roll_no = ?, student_name = ?, email = ?,
               dept_id = ?, sem_id = ?, batch = ?`;
    const params = [rollNo, studentName, email || null, deptId, semId, batch || ''];

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

// Student profile for user-dashboard
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

    const [marks] = await pool.query(
      `SELECT m.id, m.marks, m.max_marks, c.course_name, c.course_code
       FROM marks m
       JOIN courses c ON m.course_id = c.id
       WHERE m.student_id = ?
       ORDER BY c.course_code`,
      [student.id]
    );

    res.json({ ok: true, student, results, marks });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Failed to load student profile.", error: error.message });
  }
});

// ─── FACULTY ─────────────────────────────────────────────────
app.post("/api/faculty", async (req, res) => {
  const { facultyCode, facultyName, email, deptId, password } = req.body;

  if (!facultyCode || !facultyName || !password) {
    return res.status(400).json({ ok: false, message: "Faculty code, name, and password are required." });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO faculty (faculty_code, faculty_name, email, password, password_hash, dept_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [facultyCode, facultyName, email || null, password, hashPassword(password), deptId]
    );
    res.json({ ok: true, facultyId: result.insertId, message: "Faculty added." });
  } catch (error) {
    if (isDuplicateError(error)) {
      return res.status(409).json({ ok: false, message: "Faculty with this code or email already exists." });
    }
    res.status(500).json({ ok: false, message: "Failed to add faculty.", error: error.message });
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

// Faculty profile for user-dashboard
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
      `SELECT DISTINCT c.course_code, c.course_name, sm.sem_number
       FROM course_faculty_mapping cfm
       JOIN courses   c  ON cfm.course_id  = c.id
       JOIN semesters sm ON c.sem_id       = sm.id
       WHERE cfm.faculty_id = ?`,
      [faculty.id]
    );

    res.json({ ok: true, faculty, courses, students: [] });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Failed to load faculty profile.", error: error.message });
  }
});

// ─── COURSE-FACULTY MAPPINGS ──────────────────────────────────
// Only one mapping table: course_faculty_mapping(id, course_id, faculty_id)
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

// Assignments alias (same as mappings for frontend compatibility)
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
// Column is "marks" not "marks_obtained"; PK is "id" not "marks_id"
app.post("/api/marks", async (req, res) => {
  const { studentId, courseId, marksObtained } = req.body;
  if (!studentId || !courseId || marksObtained === undefined) {
    return res.status(400).json({ ok: false, message: "Student, course, and marks are required." });
  }
  try {
    const [result] = await pool.query(
      "INSERT INTO marks (student_id, course_id, marks) VALUES (?, ?, ?)",
      [studentId, courseId, marksObtained]
    );
    res.json({ ok: true, marksId: result.insertId, message: "Marks added." });
  } catch (error) {
    if (isDuplicateError(error)) {
      return res.status(409).json({ ok: false, message: "Marks for this student and course already exist." });
    }
    res.status(500).json({ ok: false, message: "Failed to add marks.", error: error.message });
  }
});

app.put("/api/marks/:id", async (req, res) => {
  const { marksObtained } = req.body;
  try {
    await pool.query(
      "UPDATE marks SET marks = ? WHERE id = ?",
      [marksObtained, req.params.id]
    );
    res.json({ ok: true, message: "Marks updated." });
  } catch (error) {
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
// Table is "results" not "semester_results"; PK is "id" not "result_id"
app.post("/api/results/generate", async (req, res) => {
  const { studentId, semId } = req.body;
  if (!studentId || !semId) {
    return res.status(400).json({ ok: false, message: "Student and semester are required." });
  }
  try {
    // Calculate GPA from marks
    const [marksRows] = await pool.query(
      `SELECT m.marks, m.max_marks, c.credits
       FROM marks m
       JOIN courses c ON m.course_id = c.id
       WHERE m.student_id = ? AND c.sem_id = ?`,
      [studentId, semId]
    );

    if (!marksRows.length) {
      return res.status(400).json({ ok: false, message: "No marks found for this student and semester." });
    }

    const totalCredits = marksRows.reduce((sum, r) => sum + r.credits, 0);
    const weightedGpa  = marksRows.reduce((sum, r) => sum + (r.marks / r.max_marks) * 10 * r.credits, 0);
    const gpa          = totalCredits > 0 ? (weightedGpa / totalCredits).toFixed(2) : 0;
    const minMarks     = Math.min(...marksRows.map(r => r.marks));
    const status       = minMarks >= 40 ? "PASS" : "FAIL";

    await pool.query(
      `INSERT INTO results (student_id, sem_id, gpa, pass_fail_status)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE gpa = VALUES(gpa), pass_fail_status = VALUES(pass_fail_status)`,
      [studentId, semId, gpa, status]
    );

    res.json({ ok: true, message: "Result generated.", gpa, status });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Failed to generate result.", error: error.message });
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

// ─── CGPA ────────────────────────────────────────────────────
app.post("/api/cgpa", async (req, res) => {
  const { studentRoll, cgpa } = req.body;
  if (!studentRoll || cgpa === undefined) {
    return res.status(400).json({ ok: false, message: "Student roll and CGPA are required." });
  }
  try {
    const [[student]] = await pool.query(
      "SELECT id FROM students WHERE roll_no = ?", [studentRoll]
    );
    if (!student) {
      return res.status(404).json({ ok: false, message: "Student not found." });
    }

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

// ─── STATIC FALLBACK ─────────────────────────────────────────
app.get("*", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

// ─── START SERVER ────────────────────────────────────────────
app.listen(port, "0.0.0.0", () => {
  console.log(`Server running at http://0.0.0.0:${port}`);
});