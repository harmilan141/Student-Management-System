  const path = require("path");
  const express = require("express");
  const mysql = require("mysql2/promise");
  const dotenv = require("dotenv");
  const crypto = require("crypto");

  dotenv.config();

  const app = express();
  const port = process.env.PORT || 3000;
  const useSsl = (process.env.DB_SSL || "true").toLowerCase() !== "false";
  const publicDir = path.join(__dirname, "public");

  const pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "defaultdb",
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    waitForConnections: true,
    connectionLimit: 10
  });

  app.use(express.json());
  app.use(express.static(publicDir));

  function hashPassword(password) {
    return crypto.createHash("sha256").update(password).digest("hex");
  }

  function isDuplicateError(error) {
    return error && error.code === "ER_DUP_ENTRY";
  }

  app.get("/api/health", async (req, res) => {
    try {
      await pool.query("SELECT 1");
      res.json({ ok: true, message: "Server and database connection are working." });
    } catch (error) {
      res.status(500).json({ ok: false, message: "Database connection failed.", error: error.message });
    }
  });

  app.post("/api/login", async (req, res) => {
    const { userId, password, role } = req.body;

    if (!userId || !password || !role) {
      return res.status(400).json({ ok: false, message: "User ID, password, and role are required." });
    }

    const queries = {
      admin: {
        sql: `SELECT admin_id, admin_username AS user_id, full_name, email, 'admin' AS role
              FROM admins
              WHERE admin_username = ? AND password_hash = ?
              LIMIT 1`
      },
      student: {
        sql: `SELECT student_id, roll_no AS user_id, student_name AS full_name, email, 'student' AS role
              FROM students
              WHERE roll_no = ? AND password_hash = ?
              LIMIT 1`
      },
      faculty: {
        sql: `SELECT faculty_id, faculty_code AS user_id, faculty_name AS full_name, email, 'faculty' AS role
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

  app.get("/api/lookups", async (req, res) => {
    try {
      const [departments] = await pool.query(
        "SELECT dept_id, dept_code, dept_name FROM departments ORDER BY dept_name"
      );
      const [semesters] = await pool.query(
        "SELECT sem_id, sem_number, sem_name FROM semesters ORDER BY sem_number"
      );
      const [courses] = await pool.query(
        `SELECT c.course_id, c.course_code, c.course_name, c.credits, c.max_marks,
                s.sem_number, s.sem_name
        FROM courses c
        INNER JOIN semesters s ON s.sem_id = c.sem_id
        ORDER BY s.sem_number, c.course_code`
      );
      const [faculty] = await pool.query(
        `SELECT f.faculty_id, f.faculty_code, f.faculty_name, d.dept_name
        FROM faculty f
        INNER JOIN departments d ON d.dept_id = f.dept_id
        ORDER BY f.faculty_name`
      );

      res.json({ ok: true, departments, semesters, courses, faculty });
    } catch (error) {
      res.status(500).json({ ok: false, message: "Unable to load lookup data.", error: error.message });
    }
  });

  app.get("/api/dashboard-data", async (req, res) => {
    try {
      const search = (req.query.search || "").trim();
      const departmentId = req.query.departmentId ? Number(req.query.departmentId) : null;

      let studentSql = `
        SELECT s.student_id, s.roll_no, s.university_roll_no, s.student_name, s.batch, s.class_batch,
              d.dept_name, sem.sem_number,
              GROUP_CONCAT(DISTINCT f.faculty_name ORDER BY f.faculty_name SEPARATOR ', ') AS assigned_faculty
        FROM students s
        INNER JOIN departments d ON d.dept_id = s.dept_id
        INNER JOIN semesters sem ON sem.sem_id = s.sem_id
        LEFT JOIN marks m ON m.student_id = s.student_id
        LEFT JOIN faculty f ON f.faculty_id = m.faculty_id
        WHERE 1=1`;
      const studentParams = [];

      if (search) {
        studentSql += `
          AND (
            s.roll_no LIKE ?
            OR s.student_name LIKE ?
            OR d.dept_name LIKE ?
          )`;
        const searchPattern = `%${search}%`;
        studentParams.push(searchPattern, searchPattern, searchPattern);
      }

      if (departmentId) {
        studentSql += " AND s.dept_id = ?";
        studentParams.push(departmentId);
      }

      studentSql += `
        GROUP BY s.student_id
        ORDER BY s.created_at DESC`;

      const [students] = await pool.query(studentSql, studentParams);

      const [departments] = await pool.query(
        "SELECT dept_id, dept_code, dept_name FROM departments ORDER BY dept_name"
      );

      const [semesters] = await pool.query(
        "SELECT sem_id, sem_number, sem_name FROM semesters ORDER BY sem_number"
      );

      const [courses] = await pool.query(
        `SELECT c.course_id, c.course_code, c.course_name, c.credits, c.max_marks,
                s.sem_number, dcm.dept_id, d.dept_name
        FROM courses c
        INNER JOIN semesters s ON s.sem_id = c.sem_id
        LEFT JOIN department_course_mapping dcm ON dcm.course_id = c.course_id
        LEFT JOIN departments d ON d.dept_id = dcm.dept_id
        ORDER BY s.sem_number, c.course_code`
      );

      const [faculty] = await pool.query(
        `SELECT f.faculty_id, f.faculty_code, f.emp_id, f.faculty_name, f.designation,
                f.specialization, f.email, d.dept_name
        FROM faculty f
        INNER JOIN departments d ON d.dept_id = f.dept_id
        ORDER BY f.created_at DESC`
      );

      const [departmentCourseMappings] = await pool.query(
        `SELECT m.dept_course_id, d.dept_code, d.dept_name, c.course_code, c.course_name
        FROM department_course_mapping m
        INNER JOIN departments d ON d.dept_id = m.dept_id
        INNER JOIN courses c ON c.course_id = m.course_id
        ORDER BY d.dept_name, c.course_code`
      );

      const [facultyCourseAssignments] = await pool.query(
        `SELECT a.faculty_course_id, f.faculty_code, f.faculty_name,
                c.course_code, c.course_name, d.dept_name
        FROM faculty_course_assignment a
        INNER JOIN faculty f ON f.faculty_id = a.faculty_id
        INNER JOIN courses c ON c.course_id = a.course_id
        INNER JOIN departments d ON d.dept_id = a.dept_id
        ORDER BY f.faculty_name, c.course_code`
      );

      const [marks] = await pool.query(
        `SELECT m.marks_id, s.roll_no, s.student_name, c.course_code, c.course_name,
                f.faculty_code, f.faculty_name, m.marks_obtained, m.grade, m.grade_point
        FROM marks m
        INNER JOIN students s ON s.student_id = m.student_id
        INNER JOIN courses c ON c.course_id = m.course_id
        INNER JOIN faculty f ON f.faculty_id = m.faculty_id
        ORDER BY m.updated_at DESC`
      );

      const [results] = await pool.query(
        `SELECT r.result_id, s.roll_no, s.student_name, sem.sem_number, r.gpa, r.pass_fail_status, r.generated_at
        FROM semester_results r
        INNER JOIN students s ON s.student_id = r.student_id
        INNER JOIN semesters sem ON sem.sem_id = r.sem_id
        ORDER BY r.generated_at DESC`
      );

      const [activityLogs] = await pool.query(
        `SELECT l.log_id, f.faculty_code, f.faculty_name, s.roll_no, c.course_code,
                l.old_marks, l.new_marks, l.action_type, l.action_time
        FROM activity_log l
        INNER JOIN faculty f ON f.faculty_id = l.faculty_id
        INNER JOIN marks m ON m.marks_id = l.marks_id
        INNER JOIN students s ON s.student_id = m.student_id
        INNER JOIN courses c ON c.course_id = m.course_id
        ORDER BY l.action_time DESC
        LIMIT 20`
      );

      res.json({
        ok: true,
        students,
        departments,
        semesters,
        courses,
        faculty,
        departmentCourseMappings,
        facultyCourseAssignments,
        marks,
        results,
        activityLogs
      });
    } catch (error) {
      res.status(500).json({ ok: false, message: "Unable to load dashboard data.", error: error.message });
    }
  });

  app.get("/api/overview-data", async (req, res) => {
    try {
      const [[studentCountRow]] = await pool.query("SELECT COUNT(*) AS total_students FROM students");
      const [[facultyCountRow]] = await pool.query("SELECT COUNT(*) AS total_faculty FROM faculty");
      const [[courseCountRow]] = await pool.query("SELECT COUNT(*) AS total_courses FROM courses");
      const [[departmentCountRow]] = await pool.query("SELECT COUNT(*) AS total_departments FROM departments");

      const [students] = await pool.query(
        `SELECT s.roll_no, s.student_name, d.dept_name, sem.sem_number, s.batch
        FROM students s
        INNER JOIN departments d ON d.dept_id = s.dept_id
        INNER JOIN semesters sem ON sem.sem_id = s.sem_id
        ORDER BY s.created_at DESC
        LIMIT 10`
      );

      const [results] = await pool.query(
        `SELECT s.roll_no, s.student_name, sem.sem_number, r.gpa, r.pass_fail_status
        FROM semester_results r
        INNER JOIN students s ON s.student_id = r.student_id
        INNER JOIN semesters sem ON sem.sem_id = r.sem_id
        ORDER BY r.generated_at DESC
        LIMIT 8`
      );

      const [activityLogs] = await pool.query(
        `SELECT f.faculty_code, f.faculty_name, s.roll_no, c.course_code, l.new_marks, l.action_time
        FROM activity_log l
        INNER JOIN faculty f ON f.faculty_id = l.faculty_id
        INNER JOIN marks m ON m.marks_id = l.marks_id
        INNER JOIN students s ON s.student_id = m.student_id
        INNER JOIN courses c ON c.course_id = m.course_id
        ORDER BY l.action_time DESC
        LIMIT 8`
      );

      res.json({
        ok: true,
        counts: {
          students: Number(studentCountRow.total_students || 0),
          faculty: Number(facultyCountRow.total_faculty || 0),
          courses: Number(courseCountRow.total_courses || 0),
          departments: Number(departmentCountRow.total_departments || 0)
        },
        students,
        results,
        activityLogs
      });
    } catch (error) {
      res.status(500).json({ ok: false, message: "Unable to load overview data.", error: error.message });
    }
  });

  app.post("/api/departments", async (req, res) => {
    const { deptCode, deptName } = req.body;
    if (!deptCode || !deptName) {
      return res.status(400).json({ ok: false, message: "Department code and name are required." });
    }

    try {
      await pool.query(
        "INSERT INTO departments (dept_code, dept_name) VALUES (?, ?)",
        [deptCode.trim(), deptName.trim()]
      );
      res.status(201).json({ ok: true, message: "Department added successfully." });
    } catch (error) {
      const message = isDuplicateError(error) ? "Department code or name already exists." : "Unable to add department.";
      res.status(500).json({ ok: false, message, error: error.message });
    }
  });

  app.put("/api/departments/:deptId", async (req, res) => {
    const { deptCode, deptName } = req.body;
    if (!deptCode || !deptName) {
      return res.status(400).json({ ok: false, message: "Department code and name are required." });
    }

    try {
      await pool.query(
        "UPDATE departments SET dept_code = ?, dept_name = ? WHERE dept_id = ?",
        [deptCode.trim(), deptName.trim(), Number(req.params.deptId)]
      );
      res.json({ ok: true, message: "Department updated successfully." });
    } catch (error) {
      const message = isDuplicateError(error) ? "Department code or name already exists." : "Unable to update department.";
      res.status(500).json({ ok: false, message, error: error.message });
    }
  });

  app.post("/api/semesters", async (req, res) => {
    const { semNumber, semName } = req.body;
    if (!semNumber || !semName) {
      return res.status(400).json({ ok: false, message: "Semester number and name are required." });
    }

    try {
      await pool.query(
        "INSERT INTO semesters (sem_number, sem_name) VALUES (?, ?)",
        [Number(semNumber), semName.trim()]
      );
      res.status(201).json({ ok: true, message: "Semester added successfully." });
    } catch (error) {
      const message = isDuplicateError(error) ? "Semester already exists." : "Unable to add semester.";
      res.status(500).json({ ok: false, message, error: error.message });
    }
  });

  app.post("/api/courses", async (req, res) => {
    const { courseCode, courseName, credits, semId, maxMarks } = req.body;
    if (!courseCode || !courseName || !credits || !semId || !maxMarks) {
      return res.status(400).json({ ok: false, message: "All course fields are required." });
    }

    try {
      await pool.query(
        "INSERT INTO courses (course_code, course_name, credits, sem_id, max_marks) VALUES (?, ?, ?, ?, ?)",
        [courseCode.trim(), courseName.trim(), Number(credits), Number(semId), Number(maxMarks)]
      );
      res.status(201).json({ ok: true, message: "Course added successfully." });
    } catch (error) {
      const message = isDuplicateError(error) ? "Course code or course-semester combination already exists." : "Unable to add course.";
      res.status(500).json({ ok: false, message, error: error.message });
    }
  });

  app.post("/api/department-course-mappings", async (req, res) => {
    const { deptId, courseId } = req.body;
    if (!deptId || !courseId) {
      return res.status(400).json({ ok: false, message: "Department and course are required." });
    }

    try {
      await pool.query(
        "INSERT INTO department_course_mapping (dept_id, course_id) VALUES (?, ?)",
        [Number(deptId), Number(courseId)]
      );
      res.status(201).json({ ok: true, message: "Course assigned to department successfully." });
    } catch (error) {
      const message = isDuplicateError(error) ? "This department-course mapping already exists." : "Unable to assign course to department.";
      res.status(500).json({ ok: false, message, error: error.message });
    }
  });

  app.post("/api/faculty-course-assignments", async (req, res) => {
    const { facultyId, courseId, deptId } = req.body;
    if (!facultyId || !courseId || !deptId) {
      return res.status(400).json({ ok: false, message: "Faculty, course, and department are required." });
    }

    try {
      await pool.query(
        "INSERT INTO faculty_course_assignment (faculty_id, course_id, dept_id) VALUES (?, ?, ?)",
        [Number(facultyId), Number(courseId), Number(deptId)]
      );
      res.status(201).json({ ok: true, message: "Faculty assigned to course successfully." });
    } catch (error) {
      const message = isDuplicateError(error) ? "This faculty-course assignment already exists." : "Unable to assign faculty to course.";
      res.status(500).json({ ok: false, message, error: error.message });
    }
  });

  app.post("/api/faculty", async (req, res) => {
    const {
      empId,
      facultyCode,
      facultyName,
      gender,
      dob,
      qualification,
      specialization,
      designation,
      phoneNo,
      email,
      password,
      deptId
    } = req.body;

    if (!empId || !facultyCode || !facultyName || !gender || !dob || !qualification || !specialization ||
        !designation || !phoneNo || !email || !password || !deptId) {
      return res.status(400).json({ ok: false, message: "All faculty fields are required." });
    }

    try {
      await pool.query(
        `INSERT INTO faculty (
          emp_id, faculty_code, faculty_name, gender, dob, qualification,
          specialization, designation, phone_no, email, password_hash, dept_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          empId.trim(),
          facultyCode.trim(),
          facultyName.trim(),
          gender,
          dob,
          qualification.trim(),
          specialization.trim(),
          designation,
          phoneNo.trim(),
          email.trim(),
          hashPassword(password),
          Number(deptId)
        ]
      );
      res.status(201).json({ ok: true, message: "Faculty added successfully." });
    } catch (error) {
      const message = isDuplicateError(error) ? "Faculty ID, employee ID, phone, or email already exists." : "Unable to add faculty.";
      res.status(500).json({ ok: false, message, error: error.message });
    }
  });

  app.put("/api/faculty/:facultyId", async (req, res) => {
    const {
      facultyName,
      qualification,
      specialization,
      designation,
      phoneNo,
      email,
      deptId
    } = req.body;

    if (!facultyName || !qualification || !specialization || !designation || !phoneNo || !email || !deptId) {
      return res.status(400).json({ ok: false, message: "All faculty update fields are required." });
    }

    try {
      await pool.query(
        `UPDATE faculty
        SET faculty_name = ?, qualification = ?, specialization = ?, designation = ?,
            phone_no = ?, email = ?, dept_id = ?
        WHERE faculty_id = ?`,
        [
          facultyName.trim(),
          qualification.trim(),
          specialization.trim(),
          designation,
          phoneNo.trim(),
          email.trim(),
          Number(deptId),
          Number(req.params.facultyId)
        ]
      );
      res.json({ ok: true, message: "Faculty updated successfully." });
    } catch (error) {
      const message = isDuplicateError(error) ? "Phone or email already exists." : "Unable to update faculty.";
      res.status(500).json({ ok: false, message, error: error.message });
    }
  });

  app.post("/api/students", async (req, res) => {
    const {
      rollNo,
      universityRollNo,
      studentName,
      fatherName,
      motherName,
      gender,
      dob,
      phoneNo,
      parentPhone,
      email,
      address,
      batch,
      classBatch,
      password,
      deptId,
      semId
    } = req.body;

    if (!rollNo || !universityRollNo || !studentName || !fatherName || !motherName || !gender || !dob ||
        !phoneNo || !parentPhone || !email || !address || !batch || !classBatch || !password || !deptId || !semId) {
      return res.status(400).json({ ok: false, message: "All student fields are required." });
    }

    try {
      await pool.query(
        `INSERT INTO students (
          roll_no, university_roll_no, student_name, father_name, mother_name, gender, dob,
          phone_no, parent_phone, email, address, batch, class_batch, password_hash, dept_id, sem_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          rollNo.trim(),
          universityRollNo.trim(),
          studentName.trim(),
          fatherName.trim(),
          motherName.trim(),
          gender,
          dob,
          phoneNo.trim(),
          parentPhone.trim(),
          email.trim(),
          address.trim(),
          batch.trim(),
          classBatch.trim(),
          hashPassword(password),
          Number(deptId),
          Number(semId)
        ]
      );
      res.status(201).json({ ok: true, message: "Student added successfully." });
    } catch (error) {
      const message = isDuplicateError(error) ? "Student roll number, phone, or email already exists." : "Unable to add student.";
      res.status(500).json({ ok: false, message, error: error.message });
    }
  });

  app.put("/api/students/:studentId", async (req, res) => {
    const {
      studentName,
      fatherName,
      motherName,
      phoneNo,
      parentPhone,
      email,
      address,
      batch,
      classBatch,
      deptId,
      semId
    } = req.body;

    if (!studentName || !fatherName || !motherName || !phoneNo || !parentPhone || !email || !address || !batch || !classBatch || !deptId || !semId) {
      return res.status(400).json({ ok: false, message: "All student update fields are required." });
    }

    try {
      await pool.query(
        `UPDATE students
        SET student_name = ?, father_name = ?, mother_name = ?, phone_no = ?, parent_phone = ?,
            email = ?, address = ?, batch = ?, class_batch = ?, dept_id = ?, sem_id = ?
        WHERE student_id = ?`,
        [
          studentName.trim(),
          fatherName.trim(),
          motherName.trim(),
          phoneNo.trim(),
          parentPhone.trim(),
          email.trim(),
          address.trim(),
          batch.trim(),
          classBatch.trim(),
          Number(deptId),
          Number(semId),
          Number(req.params.studentId)
        ]
      );
      res.json({ ok: true, message: "Student updated successfully." });
    } catch (error) {
      const message = isDuplicateError(error) ? "Phone or email already exists." : "Unable to update student.";
      res.status(500).json({ ok: false, message, error: error.message });
    }
  });

  app.delete("/api/students/:studentId", async (req, res) => {
    try {
      await pool.query("CALL sp_delete_student(?)", [Number(req.params.studentId)]);
      res.json({ ok: true, message: "Student deleted successfully." });
    } catch (error) {
      const message = error.sqlMessage || error.message || "Unable to delete student.";
      res.status(500).json({ ok: false, message });
    }
  });

  app.post("/api/marks", async (req, res) => {
    const { rollNo, courseId, facultyId, marksObtained } = req.body;
    if (!rollNo || !courseId || !facultyId || marksObtained === undefined) {
      return res.status(400).json({ ok: false, message: "Roll number, course, faculty, and marks are required." });
    }

    try {
      const [studentRows] = await pool.query("SELECT student_id FROM students WHERE roll_no = ? LIMIT 1", [rollNo.trim()]);
      if (studentRows.length === 0) {
        return res.status(404).json({ ok: false, message: "Student not found." });
      }

      await pool.query(
        "INSERT INTO marks (student_id, course_id, faculty_id, marks_obtained) VALUES (?, ?, ?, ?)",
        [studentRows[0].student_id, Number(courseId), Number(facultyId), Number(marksObtained)]
      );
      res.status(201).json({ ok: true, message: "Marks entered successfully." });
    } catch (error) {
      const message = error.sqlMessage || (isDuplicateError(error) ? "Marks for this student-course already exist." : "Unable to enter marks.");
      res.status(500).json({ ok: false, message, error: error.message });
    }
  });

  app.put("/api/marks/:marksId", async (req, res) => {
    const { marksObtained, facultyId } = req.body;
    if (marksObtained === undefined || !facultyId) {
      return res.status(400).json({ ok: false, message: "Updated marks and faculty are required." });
    }

    try {
      await pool.query(
        "UPDATE marks SET marks_obtained = ?, faculty_id = ? WHERE marks_id = ?",
        [Number(marksObtained), Number(facultyId), Number(req.params.marksId)]
      );
      res.json({ ok: true, message: "Marks updated successfully." });
    } catch (error) {
      const message = error.sqlMessage || "Unable to update marks.";
      res.status(500).json({ ok: false, message, error: error.message });
    }
  });

  app.post("/api/results/generate", async (req, res) => {
    const { rollNo, semId } = req.body;
    if (!rollNo || !semId) {
      return res.status(400).json({ ok: false, message: "Roll number and semester are required." });
    }

    try {
      const [studentRows] = await pool.query("SELECT student_id FROM students WHERE roll_no = ? LIMIT 1", [rollNo.trim()]);
      if (studentRows.length === 0) {
        return res.status(404).json({ ok: false, message: "Student not found." });
      }

      await pool.query("CALL sp_generate_semester_result(?, ?)", [studentRows[0].student_id, Number(semId)]);
      res.json({ ok: true, message: "Semester result generated successfully." });
    } catch (error) {
      const message = error.sqlMessage || "Unable to generate result.";
      res.status(500).json({ ok: false, message, error: error.message });
    }
  });

  app.get("/api/student/:rollNo", async (req, res) => {
    try {
      const [studentRows] = await pool.query(
        `SELECT s.student_id, s.roll_no, s.university_roll_no, s.student_name, s.father_name, s.mother_name,
                s.gender, s.dob, s.phone_no, s.parent_phone, s.email, s.address, s.batch, s.class_batch,
                d.dept_name, sem.sem_number, sem.sem_name
        FROM students s
        INNER JOIN departments d ON d.dept_id = s.dept_id
        INNER JOIN semesters sem ON sem.sem_id = s.sem_id
        WHERE s.roll_no = ?
        LIMIT 1`,
        [req.params.rollNo]
      );

      if (studentRows.length === 0) {
        return res.status(404).json({ ok: false, message: "Student not found." });
      }

      const [marksRows] = await pool.query(
        `SELECT c.course_code, c.course_name, c.credits, m.marks_obtained, m.grade, m.grade_point, f.faculty_name
        FROM marks m
        INNER JOIN courses c ON c.course_id = m.course_id
        INNER JOIN faculty f ON f.faculty_id = m.faculty_id
        WHERE m.student_id = ?
        ORDER BY c.course_code`,
        [studentRows[0].student_id]
      );

      const [resultRows] = await pool.query(
        `SELECT sem.sem_number, r.gpa, r.pass_fail_status, r.generated_at
        FROM semester_results r
        INNER JOIN semesters sem ON sem.sem_id = r.sem_id
        WHERE r.student_id = ?
        ORDER BY sem.sem_number DESC`,
        [studentRows[0].student_id]
      );

      res.json({ ok: true, student: studentRows[0], marks: marksRows, results: resultRows });
    } catch (error) {
      res.status(500).json({ ok: false, message: "Unable to load student profile.", error: error.message });
    }
  });

  app.get("/api/faculty/:facultyCode", async (req, res) => {
    try {
      const [facultyRows] = await pool.query(
        `SELECT f.faculty_id, f.faculty_code, f.emp_id, f.faculty_name, f.gender, f.dob,
                f.qualification, f.specialization, f.designation, f.phone_no, f.email, d.dept_name
        FROM faculty f
        INNER JOIN departments d ON d.dept_id = f.dept_id
        WHERE f.faculty_code = ?
        LIMIT 1`,
        [req.params.facultyCode]
      );

      if (facultyRows.length === 0) {
        return res.status(404).json({ ok: false, message: "Faculty not found." });
      }

      const [coursesRows] = await pool.query(
        `SELECT c.course_code, c.course_name, c.credits, sem.sem_number, d.dept_name
        FROM faculty_course_assignment a
        INNER JOIN courses c ON c.course_id = a.course_id
        INNER JOIN semesters sem ON sem.sem_id = c.sem_id
        INNER JOIN departments d ON d.dept_id = a.dept_id
        WHERE a.faculty_id = ?
        ORDER BY sem.sem_number, c.course_code`,
        [facultyRows[0].faculty_id]
      );

      const [activityRows] = await pool.query(
        `SELECT l.action_type, l.old_marks, l.new_marks, l.action_time, s.roll_no, c.course_code
        FROM activity_log l
        INNER JOIN marks m ON m.marks_id = l.marks_id
        INNER JOIN students s ON s.student_id = m.student_id
        INNER JOIN courses c ON c.course_id = m.course_id
        WHERE l.faculty_id = ?
        ORDER BY l.action_time DESC`,
        [facultyRows[0].faculty_id]
      );

      res.json({ ok: true, faculty: facultyRows[0], courses: coursesRows, activities: activityRows });
    } catch (error) {
      res.status(500).json({ ok: false, message: "Unable to load faculty profile.", error: error.message });
    }
  });

  app.get("*", (req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });

  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
