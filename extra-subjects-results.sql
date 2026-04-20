USE defaultdb;

/*
  Extra academic data:
  - creates student_cgpa table if it does not already exist
  - adds more subjects/courses
  - maps them to departments
  - assigns faculty
  - inserts marks
  - generates semester results
  - inserts sample CGPA records
*/

CREATE TABLE IF NOT EXISTS student_cgpa (
  cgpa_id INT PRIMARY KEY AUTO_INCREMENT,
  student_id INT NOT NULL UNIQUE,
  cgpa DECIMAL(4,2) NOT NULL,
  remarks VARCHAR(255),
  updated_by_faculty_id INT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_cgpa_student FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
  CONSTRAINT fk_cgpa_faculty FOREIGN KEY (updated_by_faculty_id) REFERENCES faculty(faculty_id) ON DELETE SET NULL
);

INSERT IGNORE INTO courses (course_code, course_name, credits, sem_id, max_marks) VALUES
('CSE202', 'Object Oriented Programming', 4, (SELECT sem_id FROM semesters WHERE sem_number = 2), 100),
('CSE302', 'Computer Organization', 4, (SELECT sem_id FROM semesters WHERE sem_number = 3), 100),
('CSE402', 'Design and Analysis of Algorithms', 4, (SELECT sem_id FROM semesters WHERE sem_number = 4), 100),
('IT202', 'Python Programming', 4, (SELECT sem_id FROM semesters WHERE sem_number = 2), 100),
('IT302', 'Data Analytics', 4, (SELECT sem_id FROM semesters WHERE sem_number = 3), 100),
('IT402', 'Mobile Application Development', 4, (SELECT sem_id FROM semesters WHERE sem_number = 4), 100),
('ECE202', 'Analog Circuits', 4, (SELECT sem_id FROM semesters WHERE sem_number = 2), 100),
('ECE302', 'Digital Signal Processing', 4, (SELECT sem_id FROM semesters WHERE sem_number = 3), 100),
('ECE402', 'VLSI Design', 4, (SELECT sem_id FROM semesters WHERE sem_number = 4), 100);

INSERT IGNORE INTO department_course_mapping (dept_id, course_id) VALUES
((SELECT dept_id FROM departments WHERE dept_code = 'CSE'), (SELECT course_id FROM courses WHERE course_code = 'CSE202')),
((SELECT dept_id FROM departments WHERE dept_code = 'CSE'), (SELECT course_id FROM courses WHERE course_code = 'CSE302')),
((SELECT dept_id FROM departments WHERE dept_code = 'CSE'), (SELECT course_id FROM courses WHERE course_code = 'CSE402')),
((SELECT dept_id FROM departments WHERE dept_code = 'IT'), (SELECT course_id FROM courses WHERE course_code = 'IT202')),
((SELECT dept_id FROM departments WHERE dept_code = 'IT'), (SELECT course_id FROM courses WHERE course_code = 'IT302')),
((SELECT dept_id FROM departments WHERE dept_code = 'IT'), (SELECT course_id FROM courses WHERE course_code = 'IT402')),
((SELECT dept_id FROM departments WHERE dept_code = 'ECE'), (SELECT course_id FROM courses WHERE course_code = 'ECE202')),
((SELECT dept_id FROM departments WHERE dept_code = 'ECE'), (SELECT course_id FROM courses WHERE course_code = 'ECE302')),
((SELECT dept_id FROM departments WHERE dept_code = 'ECE'), (SELECT course_id FROM courses WHERE course_code = 'ECE402'));

INSERT IGNORE INTO faculty_course_assignment (faculty_id, course_id, dept_id) VALUES
((SELECT faculty_id FROM faculty WHERE faculty_code = 'FAC401'), (SELECT course_id FROM courses WHERE course_code = 'CSE202'), (SELECT dept_id FROM departments WHERE dept_code = 'CSE')),
((SELECT faculty_id FROM faculty WHERE faculty_code = 'FAC402'), (SELECT course_id FROM courses WHERE course_code = 'CSE302'), (SELECT dept_id FROM departments WHERE dept_code = 'CSE')),
((SELECT faculty_id FROM faculty WHERE faculty_code = 'FAC403'), (SELECT course_id FROM courses WHERE course_code = 'CSE402'), (SELECT dept_id FROM departments WHERE dept_code = 'CSE')),
((SELECT faculty_id FROM faculty WHERE faculty_code = 'FAC406'), (SELECT course_id FROM courses WHERE course_code = 'IT202'), (SELECT dept_id FROM departments WHERE dept_code = 'IT')),
((SELECT faculty_id FROM faculty WHERE faculty_code = 'FAC407'), (SELECT course_id FROM courses WHERE course_code = 'IT302'), (SELECT dept_id FROM departments WHERE dept_code = 'IT')),
((SELECT faculty_id FROM faculty WHERE faculty_code = 'FAC408'), (SELECT course_id FROM courses WHERE course_code = 'IT402'), (SELECT dept_id FROM departments WHERE dept_code = 'IT')),
((SELECT faculty_id FROM faculty WHERE faculty_code = 'FAC410'), (SELECT course_id FROM courses WHERE course_code = 'ECE202'), (SELECT dept_id FROM departments WHERE dept_code = 'ECE')),
((SELECT faculty_id FROM faculty WHERE faculty_code = 'FAC411'), (SELECT course_id FROM courses WHERE course_code = 'ECE302'), (SELECT dept_id FROM departments WHERE dept_code = 'ECE')),
((SELECT faculty_id FROM faculty WHERE faculty_code = 'FAC412'), (SELECT course_id FROM courses WHERE course_code = 'ECE402'), (SELECT dept_id FROM departments WHERE dept_code = 'ECE'));

INSERT IGNORE INTO marks (student_id, course_id, faculty_id, marks_obtained) VALUES
((SELECT student_id FROM students WHERE roll_no = 'STU1002'), (SELECT course_id FROM courses WHERE course_code = 'IT202'), (SELECT faculty_id FROM faculty WHERE faculty_code = 'FAC406'), 82),
((SELECT student_id FROM students WHERE roll_no = 'STU1003'), (SELECT course_id FROM courses WHERE course_code = 'ECE302'), (SELECT faculty_id FROM faculty WHERE faculty_code = 'FAC411'), 77),
((SELECT student_id FROM students WHERE roll_no = 'STU1004'), (SELECT course_id FROM courses WHERE course_code = 'CSE402'), (SELECT faculty_id FROM faculty WHERE faculty_code = 'FAC403'), 91),
((SELECT student_id FROM students WHERE roll_no = 'STU1005'), (SELECT course_id FROM courses WHERE course_code = 'IT302'), (SELECT faculty_id FROM faculty WHERE faculty_code = 'FAC407'), 74),
((SELECT student_id FROM students WHERE roll_no = 'STU1006'), (SELECT course_id FROM courses WHERE course_code = 'ECE202'), (SELECT faculty_id FROM faculty WHERE faculty_code = 'FAC410'), 86),
((SELECT student_id FROM students WHERE roll_no = 'STU1007'), (SELECT course_id FROM courses WHERE course_code = 'CSE302'), (SELECT faculty_id FROM faculty WHERE faculty_code = 'FAC402'), 79),
((SELECT student_id FROM students WHERE roll_no = 'STU1008'), (SELECT course_id FROM courses WHERE course_code = 'IT402'), (SELECT faculty_id FROM faculty WHERE faculty_code = 'FAC408'), 88),
((SELECT student_id FROM students WHERE roll_no = 'STU1009'), (SELECT course_id FROM courses WHERE course_code = 'ECE402'), (SELECT faculty_id FROM faculty WHERE faculty_code = 'FAC412'), 81),
((SELECT student_id FROM students WHERE roll_no = 'STU1010'), (SELECT course_id FROM courses WHERE course_code = 'CSE202'), (SELECT faculty_id FROM faculty WHERE faculty_code = 'FAC401'), 84);

CALL sp_generate_semester_result(
  (SELECT student_id FROM students WHERE roll_no = 'STU1002'),
  (SELECT sem_id FROM semesters WHERE sem_number = 2)
);
CALL sp_generate_semester_result(
  (SELECT student_id FROM students WHERE roll_no = 'STU1003'),
  (SELECT sem_id FROM semesters WHERE sem_number = 3)
);
CALL sp_generate_semester_result(
  (SELECT student_id FROM students WHERE roll_no = 'STU1004'),
  (SELECT sem_id FROM semesters WHERE sem_number = 4)
);
CALL sp_generate_semester_result(
  (SELECT student_id FROM students WHERE roll_no = 'STU1005'),
  (SELECT sem_id FROM semesters WHERE sem_number = 3)
);

INSERT INTO student_cgpa (student_id, cgpa, remarks, updated_by_faculty_id) VALUES
((SELECT student_id FROM students WHERE roll_no = 'STU1001'), 8.84, 'Excellent progress', (SELECT faculty_id FROM faculty WHERE faculty_code = 'FAC401')),
((SELECT student_id FROM students WHERE roll_no = 'STU1002'), 8.10, 'Good performance in core subjects', (SELECT faculty_id FROM faculty WHERE faculty_code = 'FAC406')),
((SELECT student_id FROM students WHERE roll_no = 'STU1003'), 7.95, 'Steady improvement', (SELECT faculty_id FROM faculty WHERE faculty_code = 'FAC410')),
((SELECT student_id FROM students WHERE roll_no = 'STU1004'), 9.12, 'Outstanding semester performance', (SELECT faculty_id FROM faculty WHERE faculty_code = 'FAC403'))
ON DUPLICATE KEY UPDATE
  cgpa = VALUES(cgpa),
  remarks = VALUES(remarks),
  updated_by_faculty_id = VALUES(updated_by_faculty_id),
  updated_at = CURRENT_TIMESTAMP;

SELECT COUNT(*) AS total_courses_after_extra_seed FROM courses;
SELECT COUNT(*) AS total_results_after_extra_seed FROM semester_results;
SELECT COUNT(*) AS total_cgpa_records_after_extra_seed FROM student_cgpa;
