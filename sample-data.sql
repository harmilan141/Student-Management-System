-- ============================================================
--  College Management System — sample-data.sql
--  Run this SECOND (after database.sql) to populate all tables.
--  Passwords are stored as plain text here for demo purposes.
-- ============================================================

USE defaultdb;

-- -----------------------------------------------
-- 1. Admin account
-- -----------------------------------------------
INSERT INTO admins (name, email, password) VALUES
  ('Harmilan', 'harmilan.admin@college.edu', 'admin123');

-- -----------------------------------------------
-- 2. Departments
-- -----------------------------------------------
INSERT INTO departments (dept_code, dept_name) VALUES
  ('CSE',  'Computer Science & Engineering'),
  ('ECE',  'Electronics & Communication Engineering'),
  ('ME',   'Mechanical Engineering'),
  ('CE',   'Civil Engineering'),
  ('EE',   'Electrical Engineering');

-- -----------------------------------------------
-- 3. Semesters
-- -----------------------------------------------
INSERT INTO semesters (sem_number, sem_name) VALUES
  (1, 'Semester 1'),
  (2, 'Semester 2'),
  (3, 'Semester 3'),
  (4, 'Semester 4'),
  (5, 'Semester 5'),
  (6, 'Semester 6'),
  (7, 'Semester 7'),
  (8, 'Semester 8');

-- -----------------------------------------------
-- 4. Courses  (CSE — Semesters 1–4)
-- -----------------------------------------------
INSERT INTO courses (course_code, course_name, credits, dept_id, sem_id) VALUES
  -- Semester 1 (CSE)
  ('CSE101', 'Programming Fundamentals',        4, 1, 1),
  ('CSE102', 'Mathematics I',                   4, 1, 1),
  ('CSE103', 'Digital Logic Design',            3, 1, 1),
  ('CSE104', 'Communication Skills',            2, 1, 1),

  -- Semester 2 (CSE)
  ('CSE201', 'Data Structures',                 4, 1, 2),
  ('CSE202', 'Mathematics II',                  4, 1, 2),
  ('CSE203', 'Computer Organization',           3, 1, 2),
  ('CSE204', 'Object Oriented Programming',     3, 1, 2),

  -- Semester 3 (CSE)
  ('CSE301', 'Algorithms & Complexity',         4, 1, 3),
  ('CSE302', 'Database Management Systems',     4, 1, 3),
  ('CSE303', 'Operating Systems',               4, 1, 3),
  ('CSE304', 'Discrete Mathematics',            3, 1, 3),

  -- Semester 4 (CSE)
  ('CSE401', 'Computer Networks',               4, 1, 4),
  ('CSE402', 'Software Engineering',            3, 1, 4),
  ('CSE403', 'Theory of Computation',           3, 1, 4),
  ('CSE404', 'Web Technologies',                3, 1, 4),

  -- ECE Semester 1
  ('ECE101', 'Basic Electronics',               4, 2, 1),
  ('ECE102', 'Circuit Theory',                  4, 2, 1),

  -- ME Semester 1
  ('ME101',  'Engineering Mechanics',           4, 3, 1),
  ('ME102',  'Thermodynamics',                  4, 3, 1);

-- -----------------------------------------------
-- 5. Faculty
-- -----------------------------------------------
INSERT INTO faculty (faculty_code, faculty_name, email, password, dept_id) VALUES
  ('FAC001', 'Dr. Rajesh Kumar',    'rajesh.kumar@college.edu',   'faculty123', 1),
  ('FAC002', 'Prof. Sunita Sharma', 'sunita.sharma@college.edu',  'faculty123', 1),
  ('FAC003', 'Dr. Amit Singh',      'amit.singh@college.edu',     'faculty123', 1),
  ('FAC004', 'Prof. Priya Verma',   'priya.verma@college.edu',    'faculty123', 2),
  ('FAC005', 'Dr. Ravi Mehta',      'ravi.mehta@college.edu',     'faculty123', 3);

-- -----------------------------------------------
-- 6. Students  (CSE — Semesters 1 & 2)
-- -----------------------------------------------
INSERT INTO students (roll_no, student_name, email, password, dept_id, sem_id, batch) VALUES
  -- Batch 2024, Semester 1
  ('2024CSE001', 'Aarav Patel',    'aarav.patel@student.edu',    'student123', 1, 1, '2024'),
  ('2024CSE002', 'Priya Sharma',   'priya.sharma@student.edu',   'student123', 1, 1, '2024'),
  ('2024CSE003', 'Rohan Gupta',    'rohan.gupta@student.edu',    'student123', 1, 1, '2024'),
  ('2024CSE004', 'Sneha Singh',    'sneha.singh@student.edu',    'student123', 1, 1, '2024'),
  ('2024CSE005', 'Vikram Yadav',   'vikram.yadav@student.edu',   'student123', 1, 1, '2024'),

  -- Batch 2023, Semester 2
  ('2023CSE001', 'Anjali Mehta',   'anjali.mehta@student.edu',   'student123', 1, 2, '2023'),
  ('2023CSE002', 'Karan Joshi',    'karan.joshi@student.edu',    'student123', 1, 2, '2023'),
  ('2023CSE003', 'Divya Nair',     'divya.nair@student.edu',     'student123', 1, 2, '2023'),
  ('2023CSE004', 'Arjun Mishra',   'arjun.mishra@student.edu',   'student123', 1, 2, '2023'),
  ('2023CSE005', 'Pooja Reddy',    'pooja.reddy@student.edu',    'student123', 1, 2, '2023'),

  -- Batch 2022, Semester 3
  ('2022CSE001', 'Rahul Tiwari',   'rahul.tiwari@student.edu',   'student123', 1, 3, '2022'),
  ('2022CSE002', 'Meena Kapoor',   'meena.kapoor@student.edu',   'student123', 1, 3, '2022'),
  ('2022CSE003', 'Suresh Bansal',  'suresh.bansal@student.edu',  'student123', 1, 3, '2022'),

  -- Batch 2021, Semester 4
  ('2021CSE001', 'Neha Agarwal',   'neha.agarwal@student.edu',   'student123', 1, 4, '2021'),
  ('2021CSE002', 'Deepak Chandra', 'deepak.chandra@student.edu', 'student123', 1, 4, '2021');

-- -----------------------------------------------
-- 7. Course–Faculty Mapping
-- -----------------------------------------------
INSERT INTO course_faculty_mapping (course_id, faculty_id)
SELECT c.id, f.id
FROM courses c
JOIN faculty f ON (
     (c.course_code IN ('CSE101','CSE102','CSE103','CSE104') AND f.faculty_code = 'FAC001')
  OR (c.course_code IN ('CSE201','CSE202','CSE203','CSE204') AND f.faculty_code = 'FAC002')
  OR (c.course_code IN ('CSE301','CSE302','CSE303','CSE304') AND f.faculty_code = 'FAC003')
  OR (c.course_code IN ('CSE401','CSE402','CSE403','CSE404') AND f.faculty_code = 'FAC001')
  OR (c.course_code IN ('ECE101','ECE102')                   AND f.faculty_code = 'FAC004')
  OR (c.course_code IN ('ME101','ME102')                     AND f.faculty_code = 'FAC005')
);

-- -----------------------------------------------
-- 8. Marks  (Semester 1 students → Semester 1 courses)
-- -----------------------------------------------
INSERT INTO marks (student_id, course_id, marks, max_marks)
SELECT s.id, c.id,
  CASE
    WHEN s.roll_no = '2024CSE001' AND c.course_code = 'CSE101' THEN 85
    WHEN s.roll_no = '2024CSE001' AND c.course_code = 'CSE102' THEN 78
    WHEN s.roll_no = '2024CSE001' AND c.course_code = 'CSE103' THEN 90
    WHEN s.roll_no = '2024CSE001' AND c.course_code = 'CSE104' THEN 88

    WHEN s.roll_no = '2024CSE002' AND c.course_code = 'CSE101' THEN 92
    WHEN s.roll_no = '2024CSE002' AND c.course_code = 'CSE102' THEN 87
    WHEN s.roll_no = '2024CSE002' AND c.course_code = 'CSE103' THEN 75
    WHEN s.roll_no = '2024CSE002' AND c.course_code = 'CSE104' THEN 95

    WHEN s.roll_no = '2024CSE003' AND c.course_code = 'CSE101' THEN 65
    WHEN s.roll_no = '2024CSE003' AND c.course_code = 'CSE102' THEN 70
    WHEN s.roll_no = '2024CSE003' AND c.course_code = 'CSE103' THEN 60
    WHEN s.roll_no = '2024CSE003' AND c.course_code = 'CSE104' THEN 72

    WHEN s.roll_no = '2024CSE004' AND c.course_code = 'CSE101' THEN 88
    WHEN s.roll_no = '2024CSE004' AND c.course_code = 'CSE102' THEN 82
    WHEN s.roll_no = '2024CSE004' AND c.course_code = 'CSE103' THEN 91
    WHEN s.roll_no = '2024CSE004' AND c.course_code = 'CSE104' THEN 79

    WHEN s.roll_no = '2024CSE005' AND c.course_code = 'CSE101' THEN 55
    WHEN s.roll_no = '2024CSE005' AND c.course_code = 'CSE102' THEN 48
    WHEN s.roll_no = '2024CSE005' AND c.course_code = 'CSE103' THEN 62
    WHEN s.roll_no = '2024CSE005' AND c.course_code = 'CSE104' THEN 58

    ELSE NULL
  END AS marks,
  100 AS max_marks
FROM students s
JOIN courses c ON c.sem_id = s.sem_id AND c.dept_id = s.dept_id
WHERE s.sem_id = 1
  AND c.course_code IN ('CSE101','CSE102','CSE103','CSE104');

-- Marks for Semester 2 students
INSERT INTO marks (student_id, course_id, marks, max_marks)
SELECT s.id, c.id,
  CASE
    WHEN s.roll_no = '2023CSE001' AND c.course_code = 'CSE201' THEN 80
    WHEN s.roll_no = '2023CSE001' AND c.course_code = 'CSE202' THEN 75
    WHEN s.roll_no = '2023CSE001' AND c.course_code = 'CSE203' THEN 85
    WHEN s.roll_no = '2023CSE001' AND c.course_code = 'CSE204' THEN 88

    WHEN s.roll_no = '2023CSE002' AND c.course_code = 'CSE201' THEN 70
    WHEN s.roll_no = '2023CSE002' AND c.course_code = 'CSE202' THEN 68
    WHEN s.roll_no = '2023CSE002' AND c.course_code = 'CSE203' THEN 73
    WHEN s.roll_no = '2023CSE002' AND c.course_code = 'CSE204' THEN 77

    WHEN s.roll_no = '2023CSE003' AND c.course_code = 'CSE201' THEN 91
    WHEN s.roll_no = '2023CSE003' AND c.course_code = 'CSE202' THEN 89
    WHEN s.roll_no = '2023CSE003' AND c.course_code = 'CSE203' THEN 93
    WHEN s.roll_no = '2023CSE003' AND c.course_code = 'CSE204' THEN 87

    WHEN s.roll_no = '2023CSE004' AND c.course_code = 'CSE201' THEN 60
    WHEN s.roll_no = '2023CSE004' AND c.course_code = 'CSE202' THEN 55
    WHEN s.roll_no = '2023CSE004' AND c.course_code = 'CSE203' THEN 63
    WHEN s.roll_no = '2023CSE004' AND c.course_code = 'CSE204' THEN 58

    WHEN s.roll_no = '2023CSE005' AND c.course_code = 'CSE201' THEN 82
    WHEN s.roll_no = '2023CSE005' AND c.course_code = 'CSE202' THEN 79
    WHEN s.roll_no = '2023CSE005' AND c.course_code = 'CSE203' THEN 84
    WHEN s.roll_no = '2023CSE005' AND c.course_code = 'CSE204' THEN 86

    ELSE NULL
  END AS marks,
  100 AS max_marks
FROM students s
JOIN courses c ON c.sem_id = s.sem_id AND c.dept_id = s.dept_id
WHERE s.sem_id = 2
  AND c.course_code IN ('CSE201','CSE202','CSE203','CSE204');

-- -----------------------------------------------
-- 9. Results  (GPA on 10-point scale, auto-calculated)
-- -----------------------------------------------
-- Semester 1 results
INSERT INTO results (student_id, sem_id, gpa, pass_fail_status)
SELECT
  m.student_id,
  c.sem_id,
  ROUND(
    SUM((m.marks / m.max_marks) * 10 * c.credits) / SUM(c.credits),
    2
  ) AS gpa,
  IF(MIN(m.marks) >= 40, 'PASS', 'FAIL') AS pass_fail_status
FROM marks m
JOIN courses c ON c.id = m.course_id
JOIN students s ON s.id = m.student_id
WHERE c.sem_id = 1
GROUP BY m.student_id, c.sem_id;

-- Semester 2 results
INSERT INTO results (student_id, sem_id, gpa, pass_fail_status)
SELECT
  m.student_id,
  c.sem_id,
  ROUND(
    SUM((m.marks / m.max_marks) * 10 * c.credits) / SUM(c.credits),
    2
  ) AS gpa,
  IF(MIN(m.marks) >= 40, 'PASS', 'FAIL') AS pass_fail_status
FROM marks m
JOIN courses c ON c.id = m.course_id
JOIN students s ON s.id = m.student_id
WHERE c.sem_id = 2
GROUP BY m.student_id, c.sem_id;

-- -----------------------------------------------
-- 10. CGPA (average of all semester GPAs per student)
-- -----------------------------------------------
INSERT INTO student_cgpa (student_id, cgpa)
SELECT student_id, ROUND(AVG(gpa), 2)
FROM results
WHERE gpa IS NOT NULL
GROUP BY student_id;

-- -----------------------------------------------
-- 11. Activity Log (sample faculty mark entries)
-- -----------------------------------------------
INSERT INTO activity_log (faculty_id, student_id, course_id, new_marks)
SELECT
  cfm.faculty_id,
  m.student_id,
  m.course_id,
  m.marks
FROM marks m
JOIN course_faculty_mapping cfm ON cfm.course_id = m.course_id
WHERE m.marks IS NOT NULL
LIMIT 20;

-- -----------------------------------------------
-- Done — verify row counts
-- -----------------------------------------------
SELECT 'Sample data inserted!' AS status;

SELECT 'departments' AS tbl, COUNT(*) AS rows FROM departments
UNION ALL SELECT 'semesters',            COUNT(*) FROM semesters
UNION ALL SELECT 'courses',              COUNT(*) FROM courses
UNION ALL SELECT 'students',             COUNT(*) FROM students
UNION ALL SELECT 'faculty',              COUNT(*) FROM faculty
UNION ALL SELECT 'course_faculty_mapping', COUNT(*) FROM course_faculty_mapping
UNION ALL SELECT 'marks',                COUNT(*) FROM marks
UNION ALL SELECT 'results',              COUNT(*) FROM results
UNION ALL SELECT 'student_cgpa',         COUNT(*) FROM student_cgpa
UNION ALL SELECT 'activity_log',         COUNT(*) FROM activity_log;
