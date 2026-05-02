-- ============================================================
--  College Management System — database.sql
--  Run this FIRST in MySQL Workbench to create all tables.
--  Compatible with MySQL 8.x (Aiven cloud or local).
-- ============================================================

-- Use the correct database
USE defaultdb;

-- -----------------------------------------------
-- Drop tables in reverse dependency order
-- -----------------------------------------------
DROP TABLE IF EXISTS activity_log;
DROP TABLE IF EXISTS student_cgpa;
DROP TABLE IF EXISTS results;
DROP TABLE IF EXISTS marks;
DROP TABLE IF EXISTS course_faculty_mapping;
DROP TABLE IF EXISTS courses;
DROP TABLE IF EXISTS students;
DROP TABLE IF EXISTS faculty;
DROP TABLE IF EXISTS semesters;
DROP TABLE IF EXISTS departments;
DROP TABLE IF EXISTS admins;

-- -----------------------------------------------
-- 1. admins
-- -----------------------------------------------
CREATE TABLE admins (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(100)  NOT NULL,
  email          VARCHAR(150)  NOT NULL UNIQUE,
  password       VARCHAR(255)  NOT NULL,
  admin_username VARCHAR(50)   NOT NULL UNIQUE,
  password_hash  VARCHAR(64)   NOT NULL,
  created_at     TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -----------------------------------------------
-- 2. departments
-- -----------------------------------------------
CREATE TABLE departments (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  dept_code VARCHAR(20)  NOT NULL UNIQUE,
  dept_name VARCHAR(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -----------------------------------------------
-- 3. semesters
-- -----------------------------------------------
CREATE TABLE semesters (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  sem_number INT          NOT NULL UNIQUE,
  sem_name   VARCHAR(50)  NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -----------------------------------------------
-- 4. courses
-- -----------------------------------------------
CREATE TABLE courses (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  course_code VARCHAR(20)  NOT NULL UNIQUE,
  course_name VARCHAR(150) NOT NULL,
  credits     INT          NOT NULL DEFAULT 3,
  dept_id     INT          NOT NULL,
  sem_id      INT          NOT NULL,
  FOREIGN KEY (dept_id) REFERENCES departments(id) ON DELETE CASCADE,
  FOREIGN KEY (sem_id)  REFERENCES semesters(id)   ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -----------------------------------------------
-- 5. students
-- -----------------------------------------------
CREATE TABLE students (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  roll_no      VARCHAR(30)  NOT NULL UNIQUE,
  student_name VARCHAR(100) NOT NULL,
  email        VARCHAR(150) NOT NULL UNIQUE,
  password     VARCHAR(255) NOT NULL,
  password_hash VARCHAR(64) DEFAULT NULL,
  dept_id      INT          NOT NULL,
  sem_id       INT          NOT NULL,
  batch        VARCHAR(20)  NOT NULL,
  created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (dept_id) REFERENCES departments(id) ON DELETE CASCADE,
  FOREIGN KEY (sem_id)  REFERENCES semesters(id)   ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -----------------------------------------------
-- 6. faculty
-- -----------------------------------------------
CREATE TABLE faculty (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  faculty_code VARCHAR(20)  NOT NULL UNIQUE,
  faculty_name VARCHAR(100) NOT NULL,
  email        VARCHAR(150) NOT NULL UNIQUE,
  password     VARCHAR(255) NOT NULL,
  password_hash VARCHAR(64) DEFAULT NULL,
  dept_id      INT          NOT NULL,
  created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (dept_id) REFERENCES departments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -----------------------------------------------
-- 7. course_faculty_mapping
-- -----------------------------------------------
CREATE TABLE course_faculty_mapping (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  course_id  INT NOT NULL,
  faculty_id INT NOT NULL,
  UNIQUE KEY uq_course_faculty (course_id, faculty_id),
  FOREIGN KEY (course_id)  REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (faculty_id) REFERENCES faculty(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -----------------------------------------------
-- 8. marks
-- -----------------------------------------------
CREATE TABLE marks (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT           NOT NULL,
  course_id  INT           NOT NULL,
  marks      DECIMAL(5,2)  DEFAULT NULL,
  max_marks  DECIMAL(5,2)  NOT NULL DEFAULT 100,
  updated_at TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_student_course (student_id, course_id),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id)  REFERENCES courses(id)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -----------------------------------------------
-- 9. results
-- -----------------------------------------------
CREATE TABLE results (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  student_id      INT           NOT NULL,
  sem_id          INT           NOT NULL,
  gpa             DECIMAL(4,2)  DEFAULT NULL,
  pass_fail_status VARCHAR(10)  NOT NULL DEFAULT 'PENDING',
  generated_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_student_sem (student_id, sem_id),
  FOREIGN KEY (student_id) REFERENCES students(id)  ON DELETE CASCADE,
  FOREIGN KEY (sem_id)     REFERENCES semesters(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -----------------------------------------------
-- 10. student_cgpa
-- -----------------------------------------------
CREATE TABLE student_cgpa (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT           NOT NULL UNIQUE,
  cgpa       DECIMAL(4,2)  DEFAULT NULL,
  updated_at TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -----------------------------------------------
-- 11. activity_log
-- -----------------------------------------------
CREATE TABLE activity_log (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  faculty_id  INT          NOT NULL,
  student_id  INT          NOT NULL,
  course_id   INT          NOT NULL,
  new_marks   DECIMAL(5,2) DEFAULT NULL,
  action_time TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (faculty_id) REFERENCES faculty(id)  ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id)  REFERENCES courses(id)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -----------------------------------------------
-- Verify creation
-- -----------------------------------------------
SELECT 'Tables created successfully!' AS status;
SHOW TABLES;
