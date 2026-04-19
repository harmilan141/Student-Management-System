USE defaultdb;

/*
  Demo seed script for a blank database.
  Inserts:
  - departments
  - semesters
  - admin
  - courses
  - 15 faculty members
  - 100 students
  - department-course mappings
  - faculty-course assignments
  Safe to run more than once because it uses INSERT IGNORE with unique IDs.
*/

INSERT IGNORE INTO departments (dept_id, dept_code, dept_name) VALUES
(1, 'CSE', 'Computer Science and Engineering'),
(2, 'IT', 'Information Technology'),
(3, 'ECE', 'Electronics and Communication Engineering');

INSERT IGNORE INTO semesters (sem_id, sem_number, sem_name) VALUES
(1, 1, 'Semester 1'),
(2, 2, 'Semester 2'),
(3, 3, 'Semester 3'),
(4, 4, 'Semester 4'),
(5, 5, 'Semester 5'),
(6, 6, 'Semester 6'),
(7, 7, 'Semester 7'),
(8, 8, 'Semester 8');

INSERT IGNORE INTO admins (
  admin_id,
  admin_username,
  full_name,
  email,
  password_hash
) VALUES
(1, 'harmilan_admin', 'Harmilan', 'harmilan.admin@college.edu', SHA2('admin123', 256));

INSERT IGNORE INTO courses (
  course_id,
  course_code,
  course_name,
  credits,
  sem_id,
  max_marks
) VALUES
(1, 'CSE101', 'Programming Fundamentals', 4, 1, 100),
(2, 'CSE201', 'Data Structures', 4, 2, 100),
(3, 'CSE301', 'Database Management Systems', 4, 3, 100),
(4, 'CSE401', 'Operating Systems', 4, 4, 100),
(5, 'CSE501', 'Computer Networks', 4, 5, 100),
(6, 'CSE601', 'Software Engineering', 3, 6, 100),
(7, 'IT101', 'Web Technology', 4, 1, 100),
(8, 'IT201', 'Java Programming', 4, 2, 100),
(9, 'IT301', 'Cloud Computing', 4, 3, 100),
(10, 'IT401', 'Information Security', 4, 4, 100),
(11, 'ECE101', 'Basic Electronics', 4, 1, 100),
(12, 'ECE201', 'Digital Logic Design', 4, 2, 100),
(13, 'ECE301', 'Signals and Systems', 4, 3, 100),
(14, 'ECE401', 'Microprocessors', 4, 4, 100),
(15, 'ECE501', 'Embedded Systems', 4, 5, 100);

INSERT IGNORE INTO faculty (
  emp_id,
  faculty_code,
  faculty_name,
  gender,
  dob,
  qualification,
  specialization,
  designation,
  phone_no,
  email,
  password_hash,
  dept_id
)
WITH RECURSIVE seq AS (
  SELECT 1 AS n
  UNION ALL
  SELECT n + 1 FROM seq WHERE n < 15
)
SELECT
  CONCAT('EMP4', LPAD(n, 3, '0')) AS emp_id,
  CONCAT('FAC4', LPAD(n, 2, '0')) AS faculty_code,
  CONCAT(
    CASE ((n - 1) MOD 5)
      WHEN 0 THEN 'Arjun'
      WHEN 1 THEN 'Kavya'
      WHEN 2 THEN 'Rohit'
      WHEN 3 THEN 'Meera'
      ELSE 'Sanjay'
    END,
    ' ',
    CASE ((n - 1) MOD 5)
      WHEN 0 THEN 'Malhotra'
      WHEN 1 THEN 'Kapoor'
      WHEN 2 THEN 'Bhardwaj'
      WHEN 3 THEN 'Nair'
      ELSE 'Saxena'
    END,
    ' ',
    LPAD(n, 2, '0')
  ) AS faculty_name,
  CASE WHEN n MOD 3 = 0 THEN 'Female' WHEN n MOD 3 = 1 THEN 'Male' ELSE 'Other' END AS gender,
  DATE_ADD('1983-01-15', INTERVAL n * 140 DAY) AS dob,
  CASE
    WHEN n MOD 4 = 0 THEN 'PhD'
    WHEN n MOD 4 = 1 THEN 'M.Tech'
    WHEN n MOD 4 = 2 THEN 'M.E.'
    ELSE 'M.Sc'
  END AS qualification,
  CASE ((n - 1) MOD 6)
    WHEN 0 THEN 'Database Systems'
    WHEN 1 THEN 'Artificial Intelligence'
    WHEN 2 THEN 'Operating Systems'
    WHEN 3 THEN 'Computer Networks'
    WHEN 4 THEN 'Embedded Systems'
    ELSE 'Software Engineering'
  END AS specialization,
  CASE
    WHEN n <= 3 THEN 'Professor'
    WHEN n <= 7 THEN 'Associate Professor'
    WHEN n <= 12 THEN 'Assistant Professor'
    ELSE 'Lecturer'
  END AS designation,
  CONCAT('91', LPAD(70000000 + n, 8, '0')) AS phone_no,
  CONCAT('faculty', LPAD(n, 2, '0'), '@college.edu') AS email,
  SHA2('faculty123', 256) AS password_hash,
  CASE ((n - 1) MOD 3)
    WHEN 0 THEN (SELECT dept_id FROM departments WHERE dept_code = 'CSE')
    WHEN 1 THEN (SELECT dept_id FROM departments WHERE dept_code = 'IT')
    ELSE (SELECT dept_id FROM departments WHERE dept_code = 'ECE')
  END AS dept_id
FROM seq;

INSERT IGNORE INTO department_course_mapping (dept_id, course_id) VALUES
(1, 1),
(1, 2),
(1, 3),
(1, 4),
(1, 5),
(1, 6),
(2, 7),
(2, 8),
(2, 9),
(2, 10),
(3, 11),
(3, 12),
(3, 13),
(3, 14),
(3, 15);

INSERT IGNORE INTO students (
  roll_no,
  university_roll_no,
  student_name,
  father_name,
  mother_name,
  gender,
  dob,
  phone_no,
  parent_phone,
  email,
  address,
  batch,
  class_batch,
  password_hash,
  dept_id,
  sem_id
)
WITH RECURSIVE seq AS (
  SELECT 1 AS n
  UNION ALL
  SELECT n + 1 FROM seq WHERE n < 100
)
SELECT
  CONCAT('STU', LPAD(1000 + n, 4, '0')) AS roll_no,
  CONCAT(
    'UNI202',
    CASE
      WHEN n <= 25 THEN '3'
      WHEN n <= 50 THEN '4'
      WHEN n <= 75 THEN '5'
      ELSE '6'
    END,
    CASE ((n - 1) MOD 3)
      WHEN 0 THEN 'CSE'
      WHEN 1 THEN 'IT'
      ELSE 'ECE'
    END,
    LPAD(1000 + n, 4, '0')
  ) AS university_roll_no,
  CONCAT(
    CASE ((n - 1) MOD 10)
      WHEN 0 THEN 'Aarav'
      WHEN 1 THEN 'Diya'
      WHEN 2 THEN 'Ishaan'
      WHEN 3 THEN 'Anaya'
      WHEN 4 THEN 'Vivaan'
      WHEN 5 THEN 'Myra'
      WHEN 6 THEN 'Krish'
      WHEN 7 THEN 'Siya'
      WHEN 8 THEN 'Aditya'
      ELSE 'Riya'
    END,
    ' ',
    CASE ((n - 1) MOD 10)
      WHEN 0 THEN 'Sharma'
      WHEN 1 THEN 'Patel'
      WHEN 2 THEN 'Gupta'
      WHEN 3 THEN 'Verma'
      WHEN 4 THEN 'Singh'
      WHEN 5 THEN 'Joshi'
      WHEN 6 THEN 'Mishra'
      WHEN 7 THEN 'Reddy'
      WHEN 8 THEN 'Kaur'
      ELSE 'Yadav'
    END,
    ' ',
    LPAD(n, 3, '0')
  ) AS student_name,
  CONCAT('Father ', LPAD(n, 3, '0')) AS father_name,
  CONCAT('Mother ', LPAD(n, 3, '0')) AS mother_name,
  CASE WHEN n MOD 3 = 0 THEN 'Female' WHEN n MOD 3 = 1 THEN 'Male' ELSE 'Other' END AS gender,
  DATE_ADD('2003-01-10', INTERVAL n * 19 DAY) AS dob,
  CONCAT('92', LPAD(60000000 + n, 8, '0')) AS phone_no,
  CONCAT('93', LPAD(50000000 + n, 8, '0')) AS parent_phone,
  CONCAT('student', LPAD(n, 3, '0'), '@college.edu') AS email,
  CONCAT(
    'House ',
    ((n - 1) MOD 48) + 1,
    ', Sector ',
    ((n - 1) MOD 12) + 1,
    ', City Campus Road'
  ) AS address,
  CASE
    WHEN n <= 25 THEN '2023-2027'
    WHEN n <= 50 THEN '2024-2028'
    WHEN n <= 75 THEN '2025-2029'
    ELSE '2026-2030'
  END AS batch,
  CONCAT(((n - 1) MOD 4) + 1, 'C', LPAD(((n - 1) MOD 60) + 1, 2, '0')) AS class_batch,
  SHA2('student123', 256) AS password_hash,
  CASE ((n - 1) MOD 3)
    WHEN 0 THEN (SELECT dept_id FROM departments WHERE dept_code = 'CSE')
    WHEN 1 THEN (SELECT dept_id FROM departments WHERE dept_code = 'IT')
    ELSE (SELECT dept_id FROM departments WHERE dept_code = 'ECE')
  END AS dept_id,
  (SELECT sem_id FROM semesters WHERE sem_number = ((n - 1) MOD 8) + 1) AS sem_id
FROM seq;

INSERT IGNORE INTO faculty_course_assignment (faculty_id, course_id, dept_id) VALUES
((SELECT faculty_id FROM faculty WHERE faculty_code = 'FAC401'), (SELECT course_id FROM courses WHERE course_code = 'CSE101'), 1),
((SELECT faculty_id FROM faculty WHERE faculty_code = 'FAC402'), (SELECT course_id FROM courses WHERE course_code = 'CSE201'), 1),
((SELECT faculty_id FROM faculty WHERE faculty_code = 'FAC403'), (SELECT course_id FROM courses WHERE course_code = 'CSE301'), 1),
((SELECT faculty_id FROM faculty WHERE faculty_code = 'FAC404'), (SELECT course_id FROM courses WHERE course_code = 'CSE401'), 1),
((SELECT faculty_id FROM faculty WHERE faculty_code = 'FAC405'), (SELECT course_id FROM courses WHERE course_code = 'CSE501'), 1),
((SELECT faculty_id FROM faculty WHERE faculty_code = 'FAC406'), (SELECT course_id FROM courses WHERE course_code = 'IT101'), 2),
((SELECT faculty_id FROM faculty WHERE faculty_code = 'FAC407'), (SELECT course_id FROM courses WHERE course_code = 'IT201'), 2),
((SELECT faculty_id FROM faculty WHERE faculty_code = 'FAC408'), (SELECT course_id FROM courses WHERE course_code = 'IT301'), 2),
((SELECT faculty_id FROM faculty WHERE faculty_code = 'FAC409'), (SELECT course_id FROM courses WHERE course_code = 'IT401'), 2),
((SELECT faculty_id FROM faculty WHERE faculty_code = 'FAC410'), (SELECT course_id FROM courses WHERE course_code = 'ECE101'), 3),
((SELECT faculty_id FROM faculty WHERE faculty_code = 'FAC411'), (SELECT course_id FROM courses WHERE course_code = 'ECE201'), 3),
((SELECT faculty_id FROM faculty WHERE faculty_code = 'FAC412'), (SELECT course_id FROM courses WHERE course_code = 'ECE301'), 3),
((SELECT faculty_id FROM faculty WHERE faculty_code = 'FAC413'), (SELECT course_id FROM courses WHERE course_code = 'ECE401'), 3),
((SELECT faculty_id FROM faculty WHERE faculty_code = 'FAC414'), (SELECT course_id FROM courses WHERE course_code = 'ECE501'), 3),
((SELECT faculty_id FROM faculty WHERE faculty_code = 'FAC415'), (SELECT course_id FROM courses WHERE course_code = 'CSE601'), 1);

INSERT IGNORE INTO marks (student_id, course_id, faculty_id, marks_obtained) VALUES
((SELECT student_id FROM students WHERE roll_no = 'STU1001'), (SELECT course_id FROM courses WHERE course_code = 'CSE101'), (SELECT faculty_id FROM faculty WHERE faculty_code = 'FAC401'), 84),
((SELECT student_id FROM students WHERE roll_no = 'STU1002'), (SELECT course_id FROM courses WHERE course_code = 'IT101'), (SELECT faculty_id FROM faculty WHERE faculty_code = 'FAC406'), 78),
((SELECT student_id FROM students WHERE roll_no = 'STU1003'), (SELECT course_id FROM courses WHERE course_code = 'ECE101'), (SELECT faculty_id FROM faculty WHERE faculty_code = 'FAC410'), 88),
((SELECT student_id FROM students WHERE roll_no = 'STU1004'), (SELECT course_id FROM courses WHERE course_code = 'CSE201'), (SELECT faculty_id FROM faculty WHERE faculty_code = 'FAC402'), 74),
((SELECT student_id FROM students WHERE roll_no = 'STU1005'), (SELECT course_id FROM courses WHERE course_code = 'IT201'), (SELECT faculty_id FROM faculty WHERE faculty_code = 'FAC407'), 81);

SELECT COUNT(*) AS total_faculty_after_seed FROM faculty;
SELECT COUNT(*) AS total_students_after_seed FROM students;
