USE defaultdb;

DELIMITER $$

-- FUNCTION: Calculate GPA for a student in a semester
DROP FUNCTION IF EXISTS calculate_gpa$$
CREATE FUNCTION calculate_gpa(p_student_id INT, p_sem_id INT)
RETURNS DECIMAL(4,2)
DETERMINISTIC
READS SQL DATA
BEGIN
  DECLARE v_gpa DECIMAL(4,2);

  SELECT ROUND(SUM((m.marks/m.max_marks)*10*c.credits)/SUM(c.credits),2)
  INTO v_gpa
  FROM marks m
  JOIN courses c ON c.id = m.course_id
  WHERE m.student_id = p_student_id AND c.sem_id = p_sem_id;

  RETURN v_gpa;
END$$


-- FUNCTION: Check PASS / FAIL / PENDING status
DROP FUNCTION IF EXISTS get_pass_fail$$
CREATE FUNCTION get_pass_fail(p_student_id INT, p_sem_id INT)
RETURNS VARCHAR(10)
DETERMINISTIC
READS SQL DATA
BEGIN
  DECLARE v_status VARCHAR(10) DEFAULT 'PENDING';
  DECLARE v_min_marks DECIMAL(5,2);
  DECLARE v_count INT;

  SELECT COUNT(*), MIN(m.marks)
  INTO v_count, v_min_marks
  FROM marks m
  JOIN courses c ON c.id = m.course_id
  WHERE m.student_id = p_student_id AND c.sem_id = p_sem_id;

  IF v_count = 0 THEN
    SET v_status = 'PENDING';
  ELSEIF v_min_marks >= 40 THEN
    SET v_status = 'PASS';
  ELSE
    SET v_status = 'FAIL';
  END IF;

  RETURN v_status;
END$$


-- FUNCTION: Convert percentage into grade (A+, A, B, etc.)
DROP FUNCTION IF EXISTS get_grade_letter$$
CREATE FUNCTION get_grade_letter(p_pct DECIMAL(5,2))
RETURNS VARCHAR(2)
DETERMINISTIC
BEGIN
  RETURN CASE
    WHEN p_pct >= 90 THEN 'A+'
    WHEN p_pct >= 80 THEN 'A'
    WHEN p_pct >= 70 THEN 'B'
    WHEN p_pct >= 60 THEN 'C'
    WHEN p_pct >= 40 THEN 'D'
    ELSE 'F'
  END;
END$$


-- PROCEDURE: Calculate GPA + status and store result + update CGPA
DROP PROCEDURE IF EXISTS sp_calculate_and_store_result$$
CREATE PROCEDURE sp_calculate_and_store_result(IN p_student_id INT, IN p_sem_id INT)
BEGIN
  DECLARE v_gpa DECIMAL(4,2);
  DECLARE v_status VARCHAR(10);

  SET v_gpa = calculate_gpa(p_student_id, p_sem_id);
  SET v_status = get_pass_fail(p_student_id, p_sem_id);

  INSERT INTO results (student_id, sem_id, gpa, pass_fail_status)
  VALUES (p_student_id, p_sem_id, v_gpa, v_status)
  ON DUPLICATE KEY UPDATE gpa=v_gpa, pass_fail_status=v_status;

  INSERT INTO student_cgpa (student_id, cgpa)
  SELECT student_id, ROUND(AVG(gpa),2)
  FROM results
  WHERE student_id = p_student_id
  GROUP BY student_id
  ON DUPLICATE KEY UPDATE cgpa=VALUES(cgpa);
END$$


-- PROCEDURE: Recalculate results for all students using CURSOR
DROP PROCEDURE IF EXISTS sp_recalculate_all_results$$
CREATE PROCEDURE sp_recalculate_all_results()
BEGIN
  DECLARE done INT DEFAULT 0;
  DECLARE v_stu_id INT;
  DECLARE v_sem_id INT;

  DECLARE cur CURSOR FOR
    SELECT DISTINCT m.student_id, c.sem_id
    FROM marks m
    JOIN courses c ON c.id = m.course_id;

  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;

  OPEN cur;

  read_loop: LOOP
    FETCH cur INTO v_stu_id, v_sem_id;

    IF done THEN
      LEAVE read_loop;
    END IF;

    CALL sp_calculate_and_store_result(v_stu_id, v_sem_id);
  END LOOP;

  CLOSE cur;
END$$


-- PROCEDURE: Insert new student after validating department & semester
DROP PROCEDURE IF EXISTS sp_enroll_student$$
CREATE PROCEDURE sp_enroll_student(
  IN p_roll_no VARCHAR(30),
  IN p_name VARCHAR(100),
  IN p_email VARCHAR(150),
  IN p_dept_code VARCHAR(20),
  IN p_sem_number INT,
  OUT p_new_id INT
)
BEGIN
  DECLARE v_dept_id INT;
  DECLARE v_sem_id INT;

  SELECT id INTO v_dept_id FROM departments WHERE dept_code = p_dept_code;
  SELECT id INTO v_sem_id FROM semesters WHERE sem_number = p_sem_number;

  INSERT INTO students (roll_no, student_name, email, dept_id, sem_id)
  VALUES (p_roll_no, p_name, p_email, v_dept_id, v_sem_id);

  SET p_new_id = LAST_INSERT_ID();
END$$


-- PROCEDURE: Add new faculty after validating department
DROP PROCEDURE IF EXISTS sp_add_faculty$$
CREATE PROCEDURE sp_add_faculty(
  IN p_code VARCHAR(20),
  IN p_name VARCHAR(100),
  IN p_email VARCHAR(150),
  IN p_dept_code VARCHAR(20),
  OUT p_new_id INT
)
BEGIN
  DECLARE v_dept_id INT;

  SELECT id INTO v_dept_id FROM departments WHERE dept_code = p_dept_code;

  INSERT INTO faculty (faculty_code, faculty_name, email, dept_id)
  VALUES (p_code, p_name, p_email, v_dept_id);

  SET p_new_id = LAST_INSERT_ID();
END$$


-- PROCEDURE: Insert/update marks + validate faculty + recalc GPA
DROP PROCEDURE IF EXISTS sp_update_marks$$
CREATE PROCEDURE sp_update_marks(
  IN p_faculty_id INT,
  IN p_student_id INT,
  IN p_course_id INT,
  IN p_marks DECIMAL(5,2)
)
BEGIN
  DECLARE v_check INT;
  DECLARE v_sem_id INT;

  SELECT COUNT(*) INTO v_check
  FROM course_faculty_mapping
  WHERE faculty_id = p_faculty_id AND course_id = p_course_id;

  IF v_check = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Not authorized';
  END IF;

  INSERT INTO marks (student_id, course_id, marks)
  VALUES (p_student_id, p_course_id, p_marks)
  ON DUPLICATE KEY UPDATE marks=p_marks;

  SELECT sem_id INTO v_sem_id FROM courses WHERE id = p_course_id;

  CALL sp_calculate_and_store_result(p_student_id, v_sem_id);
END$$


-- TRIGGER: Auto update GPA when marks inserted
DROP TRIGGER IF EXISTS trg_after_insert$$
CREATE TRIGGER trg_after_insert
AFTER INSERT ON marks
FOR EACH ROW
BEGIN
  DECLARE v_sem INT;
  SELECT sem_id INTO v_sem FROM courses WHERE id = NEW.course_id;
  CALL sp_calculate_and_store_result(NEW.student_id, v_sem);
END$$


-- TRIGGER: Auto update GPA when marks updated
DROP TRIGGER IF EXISTS trg_after_update$$
CREATE TRIGGER trg_after_update
AFTER UPDATE ON marks
FOR EACH ROW
BEGIN
  DECLARE v_sem INT;
  SELECT sem_id INTO v_sem FROM courses WHERE id = NEW.course_id;
  CALL sp_calculate_and_store_result(NEW.student_id, v_sem);
END$$

DELIMITER ;