CREATE DATABASE IF NOT EXISTS defaultdb;
USE defaultdb;

DROP TRIGGER IF EXISTS trg_marks_before_insert;
DROP TRIGGER IF EXISTS trg_marks_before_update;
DROP TRIGGER IF EXISTS trg_marks_after_update;
DROP FUNCTION IF EXISTS fn_grade_from_marks;
DROP FUNCTION IF EXISTS fn_grade_point_from_marks;
DROP PROCEDURE IF EXISTS sp_calculate_semester_gpa;
DROP PROCEDURE IF EXISTS sp_generate_semester_result;
DROP PROCEDURE IF EXISTS sp_delete_student;

DROP TABLE IF EXISTS activity_log;
DROP TABLE IF EXISTS student_cgpa;
DROP TABLE IF EXISTS semester_results;
DROP TABLE IF EXISTS marks;
DROP TABLE IF EXISTS faculty_course_assignment;
DROP TABLE IF EXISTS department_course_mapping;
DROP TABLE IF EXISTS courses;
DROP TABLE IF EXISTS students;
DROP TABLE IF EXISTS faculty;
DROP TABLE IF EXISTS admins;
DROP TABLE IF EXISTS semesters;
DROP TABLE IF EXISTS departments;

CREATE TABLE departments (
  dept_id INT PRIMARY KEY AUTO_INCREMENT,
  dept_code VARCHAR(20) NOT NULL UNIQUE,
  dept_name VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE semesters (
  sem_id INT PRIMARY KEY AUTO_INCREMENT,
  sem_number INT NOT NULL UNIQUE,
  sem_name VARCHAR(50) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_sem_number CHECK (sem_number BETWEEN 1 AND 8)
);

CREATE TABLE admins (
  admin_id INT PRIMARY KEY AUTO_INCREMENT,
  admin_username VARCHAR(50) NOT NULL UNIQUE,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  password_hash CHAR(64) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE faculty (
  faculty_id INT PRIMARY KEY AUTO_INCREMENT,
  emp_id VARCHAR(30) NOT NULL UNIQUE,
  faculty_code VARCHAR(30) NOT NULL UNIQUE,
  faculty_name VARCHAR(100) NOT NULL,
  gender ENUM('Male', 'Female', 'Other') NOT NULL,
  dob DATE NOT NULL,
  qualification VARCHAR(100) NOT NULL,
  specialization VARCHAR(100) NOT NULL,
  designation ENUM('Professor', 'Associate Professor', 'Assistant Professor', 'Lecturer') NOT NULL,
  phone_no VARCHAR(15) NOT NULL UNIQUE,
  email VARCHAR(120) NOT NULL UNIQUE,
  password_hash CHAR(64) NOT NULL,
  dept_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_faculty_department FOREIGN KEY (dept_id) REFERENCES departments(dept_id)
);

CREATE TABLE students (
  student_id INT PRIMARY KEY AUTO_INCREMENT,
  roll_no VARCHAR(30) NOT NULL UNIQUE,
  university_roll_no VARCHAR(30) NOT NULL UNIQUE,
  student_name VARCHAR(100) NOT NULL,
  father_name VARCHAR(100) NOT NULL,
  mother_name VARCHAR(100) NOT NULL,
  gender ENUM('Male', 'Female', 'Other') NOT NULL,
  dob DATE NOT NULL,
  phone_no VARCHAR(15) NOT NULL UNIQUE,
  parent_phone VARCHAR(15) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  address VARCHAR(255) NOT NULL,
  batch VARCHAR(20) NOT NULL,
  class_batch VARCHAR(20) NOT NULL,
  password_hash CHAR(64) NOT NULL,
  dept_id INT NOT NULL,
  sem_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_student_department FOREIGN KEY (dept_id) REFERENCES departments(dept_id),
  CONSTRAINT fk_student_semester FOREIGN KEY (sem_id) REFERENCES semesters(sem_id)
);

CREATE TABLE courses (
  course_id INT PRIMARY KEY AUTO_INCREMENT,
  course_code VARCHAR(20) NOT NULL UNIQUE,
  course_name VARCHAR(120) NOT NULL,
  credits INT NOT NULL,
  sem_id INT NOT NULL,
  max_marks DECIMAL(5,2) NOT NULL DEFAULT 100,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_course_semester FOREIGN KEY (sem_id) REFERENCES semesters(sem_id),
  CONSTRAINT chk_course_credits CHECK (credits > 0),
  CONSTRAINT chk_course_max_marks CHECK (max_marks > 0),
  CONSTRAINT uq_course_name_sem UNIQUE (course_name, sem_id)
);

CREATE TABLE department_course_mapping (
  dept_course_id INT PRIMARY KEY AUTO_INCREMENT,
  dept_id INT NOT NULL,
  course_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_dept_course_department FOREIGN KEY (dept_id) REFERENCES departments(dept_id) ON DELETE CASCADE,
  CONSTRAINT fk_dept_course_course FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE CASCADE,
  CONSTRAINT uq_department_course UNIQUE (dept_id, course_id)
);

CREATE TABLE faculty_course_assignment (
  faculty_course_id INT PRIMARY KEY AUTO_INCREMENT,
  faculty_id INT NOT NULL,
  course_id INT NOT NULL,
  dept_id INT NOT NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_faculty_course_faculty FOREIGN KEY (faculty_id) REFERENCES faculty(faculty_id) ON DELETE CASCADE,
  CONSTRAINT fk_faculty_course_course FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE CASCADE,
  CONSTRAINT fk_faculty_course_department FOREIGN KEY (dept_id) REFERENCES departments(dept_id) ON DELETE CASCADE,
  CONSTRAINT uq_faculty_course UNIQUE (faculty_id, course_id, dept_id)
);

CREATE TABLE marks (
  marks_id INT PRIMARY KEY AUTO_INCREMENT,
  student_id INT NOT NULL,
  course_id INT NOT NULL,
  faculty_id INT NOT NULL,
  marks_obtained DECIMAL(5,2) NOT NULL,
  grade CHAR(2),
  grade_point DECIMAL(3,2),
  entered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_marks_student FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE RESTRICT,
  CONSTRAINT fk_marks_course FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE RESTRICT,
  CONSTRAINT fk_marks_faculty FOREIGN KEY (faculty_id) REFERENCES faculty(faculty_id) ON DELETE RESTRICT,
  CONSTRAINT uq_student_course UNIQUE (student_id, course_id),
  CONSTRAINT chk_marks_non_negative CHECK (marks_obtained >= 0)
);

CREATE TABLE semester_results (
  result_id INT PRIMARY KEY AUTO_INCREMENT,
  student_id INT NOT NULL,
  sem_id INT NOT NULL,
  total_credits INT NOT NULL,
  earned_credit_points DECIMAL(10,2) NOT NULL,
  gpa DECIMAL(4,2) NOT NULL,
  pass_fail_status ENUM('PASS', 'FAIL') NOT NULL,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_result_student FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
  CONSTRAINT fk_result_semester FOREIGN KEY (sem_id) REFERENCES semesters(sem_id) ON DELETE CASCADE,
  CONSTRAINT uq_student_semester_result UNIQUE (student_id, sem_id)
);

CREATE TABLE student_cgpa (
  cgpa_id INT PRIMARY KEY AUTO_INCREMENT,
  student_id INT NOT NULL UNIQUE,
  cgpa DECIMAL(4,2) NOT NULL,
  remarks VARCHAR(255),
  updated_by_faculty_id INT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_cgpa_student FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
  CONSTRAINT fk_cgpa_faculty FOREIGN KEY (updated_by_faculty_id) REFERENCES faculty(faculty_id) ON DELETE SET NULL,
  CONSTRAINT chk_cgpa_range CHECK (cgpa >= 0 AND cgpa <= 10)
);

CREATE TABLE activity_log (
  log_id INT PRIMARY KEY AUTO_INCREMENT,
  faculty_id INT NOT NULL,
  marks_id INT NOT NULL,
  old_marks DECIMAL(5,2),
  new_marks DECIMAL(5,2),
  action_type ENUM('INSERT', 'UPDATE') NOT NULL,
  action_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_log_faculty FOREIGN KEY (faculty_id) REFERENCES faculty(faculty_id) ON DELETE CASCADE,
  CONSTRAINT fk_log_marks FOREIGN KEY (marks_id) REFERENCES marks(marks_id) ON DELETE CASCADE
);

INSERT INTO departments (dept_code, dept_name) VALUES
('CSE', 'Computer Science and Engineering'),
('IT', 'Information Technology'),
('ECE', 'Electronics and Communication Engineering');

INSERT INTO semesters (sem_number, sem_name) VALUES
(1, 'Semester 1'),
(2, 'Semester 2'),
(3, 'Semester 3'),
(4, 'Semester 4'),
(5, 'Semester 5'),
(6, 'Semester 6'),
(7, 'Semester 7'),
(8, 'Semester 8');

INSERT INTO admins (admin_username, full_name, email, password_hash) VALUES
('admin', 'System Administrator', 'admin@college.edu', SHA2('admin123', 256));

INSERT INTO faculty (
  emp_id, faculty_code, faculty_name, gender, dob, qualification, specialization,
  designation, phone_no, email, password_hash, dept_id
) VALUES
('EMP1001', 'FAC201', 'Priya Verma', 'Female', '1988-05-12', 'M.Tech', 'Database Systems',
 'Assistant Professor', '9876543201', 'priya.faculty@college.edu', SHA2('faculty123', 256),
 (SELECT dept_id FROM departments WHERE dept_code = 'CSE')),
('EMP1002', 'FAC202', 'Amit Singh', 'Male', '1985-09-18', 'PhD', 'Operating Systems',
 'Associate Professor', '9876543202', 'amit.faculty@college.edu', SHA2('faculty456', 256),
 (SELECT dept_id FROM departments WHERE dept_code = 'IT'));

INSERT INTO students (
  roll_no, university_roll_no, student_name, father_name, mother_name, gender, dob,
  phone_no, parent_phone, email, address, batch, class_batch, password_hash, dept_id, sem_id
) VALUES
('STU101', 'UNI2023CSE101', 'Rahul Sharma', 'Ramesh Sharma', 'Sunita Sharma', 'Male', '2004-02-10',
 '9876543210', '9876500010', 'rahul.student@college.edu', 'Delhi', '2023-2027', '2C34',
 SHA2('student123', 256),
 (SELECT dept_id FROM departments WHERE dept_code = 'CSE'),
 (SELECT sem_id FROM semesters WHERE sem_number = 4)),
('STU102', 'UNI2023IT102', 'Neha Patel', 'Mahesh Patel', 'Kiran Patel', 'Female', '2004-07-21',
 '9876543211', '9876500011', 'neha.student@college.edu', 'Ahmedabad', '2023-2027', '2C35',
 SHA2('student456', 256),
 (SELECT dept_id FROM departments WHERE dept_code = 'IT'),
 (SELECT sem_id FROM semesters WHERE sem_number = 2));

INSERT INTO courses (course_code, course_name, credits, sem_id, max_marks) VALUES
('CSE401', 'Database Management Systems', 4, (SELECT sem_id FROM semesters WHERE sem_number = 4), 100),
('CSE402', 'Operating Systems', 4, (SELECT sem_id FROM semesters WHERE sem_number = 4), 100),
('IT201', 'Programming in Java', 3, (SELECT sem_id FROM semesters WHERE sem_number = 2), 100);

INSERT INTO department_course_mapping (dept_id, course_id) VALUES
((SELECT dept_id FROM departments WHERE dept_code = 'CSE'), (SELECT course_id FROM courses WHERE course_code = 'CSE401')),
((SELECT dept_id FROM departments WHERE dept_code = 'CSE'), (SELECT course_id FROM courses WHERE course_code = 'CSE402')),
((SELECT dept_id FROM departments WHERE dept_code = 'IT'), (SELECT course_id FROM courses WHERE course_code = 'IT201'));

INSERT INTO faculty_course_assignment (faculty_id, course_id, dept_id) VALUES
((SELECT faculty_id FROM faculty WHERE faculty_code = 'FAC201'),
 (SELECT course_id FROM courses WHERE course_code = 'CSE401'),
 (SELECT dept_id FROM departments WHERE dept_code = 'CSE')),
((SELECT faculty_id FROM faculty WHERE faculty_code = 'FAC202'),
 (SELECT course_id FROM courses WHERE course_code = 'IT201'),
 (SELECT dept_id FROM departments WHERE dept_code = 'IT'));

DELIMITER $$

CREATE FUNCTION fn_grade_from_marks(p_marks DECIMAL(5,2), p_max_marks DECIMAL(5,2))
RETURNS CHAR(2)
DETERMINISTIC
BEGIN
  DECLARE v_percentage DECIMAL(5,2);
  SET v_percentage = (p_marks / p_max_marks) * 100;

  RETURN CASE
    WHEN v_percentage >= 90 THEN 'O'
    WHEN v_percentage >= 80 THEN 'A+'
    WHEN v_percentage >= 70 THEN 'A'
    WHEN v_percentage >= 60 THEN 'B+'
    WHEN v_percentage >= 50 THEN 'B'
    WHEN v_percentage >= 40 THEN 'C'
    ELSE 'F'
  END;
END$$

CREATE FUNCTION fn_grade_point_from_marks(p_marks DECIMAL(5,2), p_max_marks DECIMAL(5,2))
RETURNS DECIMAL(3,2)
DETERMINISTIC
BEGIN
  DECLARE v_percentage DECIMAL(5,2);
  SET v_percentage = (p_marks / p_max_marks) * 100;

  RETURN CASE
    WHEN v_percentage >= 90 THEN 10.00
    WHEN v_percentage >= 80 THEN 9.00
    WHEN v_percentage >= 70 THEN 8.00
    WHEN v_percentage >= 60 THEN 7.00
    WHEN v_percentage >= 50 THEN 6.00
    WHEN v_percentage >= 40 THEN 5.00
    ELSE 0.00
  END;
END$$

CREATE TRIGGER trg_marks_before_insert
BEFORE INSERT ON marks
FOR EACH ROW
BEGIN
  DECLARE v_max_marks DECIMAL(5,2);

  SELECT max_marks INTO v_max_marks
  FROM courses
  WHERE course_id = NEW.course_id;

  IF NEW.marks_obtained > v_max_marks THEN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Marks cannot be greater than max marks.';
  END IF;

  SET NEW.grade = fn_grade_from_marks(NEW.marks_obtained, v_max_marks);
  SET NEW.grade_point = fn_grade_point_from_marks(NEW.marks_obtained, v_max_marks);
END$$

CREATE TRIGGER trg_marks_before_update
BEFORE UPDATE ON marks
FOR EACH ROW
BEGIN
  DECLARE v_max_marks DECIMAL(5,2);

  SELECT max_marks INTO v_max_marks
  FROM courses
  WHERE course_id = NEW.course_id;

  IF NEW.marks_obtained > v_max_marks THEN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Marks cannot be greater than max marks.';
  END IF;

  SET NEW.grade = fn_grade_from_marks(NEW.marks_obtained, v_max_marks);
  SET NEW.grade_point = fn_grade_point_from_marks(NEW.marks_obtained, v_max_marks);
END$$

CREATE TRIGGER trg_marks_after_update
AFTER UPDATE ON marks
FOR EACH ROW
BEGIN
  IF OLD.marks_obtained <> NEW.marks_obtained THEN
    INSERT INTO activity_log (faculty_id, marks_id, old_marks, new_marks, action_type)
    VALUES (NEW.faculty_id, NEW.marks_id, OLD.marks_obtained, NEW.marks_obtained, 'UPDATE');
  END IF;
END$$

CREATE PROCEDURE sp_calculate_semester_gpa(IN p_student_id INT, IN p_sem_id INT)
BEGIN
  DECLARE done INT DEFAULT 0;
  DECLARE v_credits INT;
  DECLARE v_grade_point DECIMAL(3,2);
  DECLARE v_total_credits INT DEFAULT 0;
  DECLARE v_total_credit_points DECIMAL(10,2) DEFAULT 0;
  DECLARE v_fail_count INT DEFAULT 0;
  DECLARE v_gpa DECIMAL(4,2) DEFAULT 0;

  DECLARE cur CURSOR FOR
    SELECT c.credits, m.grade_point
    FROM marks m
    INNER JOIN courses c ON c.course_id = m.course_id
    INNER JOIN students s ON s.student_id = m.student_id
    WHERE m.student_id = p_student_id
      AND c.sem_id = p_sem_id
      AND s.sem_id = p_sem_id;

  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;

  OPEN cur;

  read_loop: LOOP
    FETCH cur INTO v_credits, v_grade_point;
    IF done = 1 THEN
      LEAVE read_loop;
    END IF;

    SET v_total_credits = v_total_credits + v_credits;
    SET v_total_credit_points = v_total_credit_points + (v_credits * v_grade_point);

    IF v_grade_point = 0 THEN
      SET v_fail_count = v_fail_count + 1;
    END IF;
  END LOOP;

  CLOSE cur;

  IF v_total_credits > 0 THEN
    SET v_gpa = ROUND(v_total_credit_points / v_total_credits, 2);
  END IF;

  INSERT INTO semester_results (student_id, sem_id, total_credits, earned_credit_points, gpa, pass_fail_status)
  VALUES (
    p_student_id,
    p_sem_id,
    v_total_credits,
    v_total_credit_points,
    v_gpa,
    IF(v_fail_count = 0, 'PASS', 'FAIL')
  )
  ON DUPLICATE KEY UPDATE
    total_credits = VALUES(total_credits),
    earned_credit_points = VALUES(earned_credit_points),
    gpa = VALUES(gpa),
    pass_fail_status = VALUES(pass_fail_status),
    generated_at = CURRENT_TIMESTAMP;
END$$

CREATE PROCEDURE sp_generate_semester_result(IN p_student_id INT, IN p_sem_id INT)
BEGIN
  START TRANSACTION;
  CALL sp_calculate_semester_gpa(p_student_id, p_sem_id);
  COMMIT;
END$$

CREATE PROCEDURE sp_delete_student(IN p_student_id INT)
BEGIN
  DECLARE v_marks_count INT DEFAULT 0;

  SELECT COUNT(*) INTO v_marks_count
  FROM marks
  WHERE student_id = p_student_id;

  IF v_marks_count > 0 THEN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Student cannot be deleted because marks already exist.';
  ELSE
    DELETE FROM students
    WHERE student_id = p_student_id;
  END IF;
END$$

DELIMITER ;

INSERT INTO marks (student_id, course_id, faculty_id, marks_obtained) VALUES
((SELECT student_id FROM students WHERE roll_no = 'STU101'),
 (SELECT course_id FROM courses WHERE course_code = 'CSE401'),
 (SELECT faculty_id FROM faculty WHERE faculty_code = 'FAC201'),
 88),
((SELECT student_id FROM students WHERE roll_no = 'STU102'),
 (SELECT course_id FROM courses WHERE course_code = 'IT201'),
 (SELECT faculty_id FROM faculty WHERE faculty_code = 'FAC202'),
 79);

CALL sp_generate_semester_result(
  (SELECT student_id FROM students WHERE roll_no = 'STU101'),
  (SELECT sem_id FROM semesters WHERE sem_number = 4)
);

CALL sp_generate_semester_result(
  (SELECT student_id FROM students WHERE roll_no = 'STU102'),
  (SELECT sem_id FROM semesters WHERE sem_number = 2)
);
