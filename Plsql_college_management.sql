-- ============================================================
--  College Management System — PL/SQL Objects
--  File: Plsql_college_management.sql
--
--  WHAT IS THIS FILE?
--  This file creates all the "smart database logic" for the
--  College Management System. It contains:
--    • Functions   – Small helpers that calculate and return a value
--    • Procedures  – Bigger blocks that do multiple tasks at once
--    • Triggers    – Auto-run code when data changes (insert/update)
--    • Events      – Scheduled jobs that run automatically at night
--
--  HOW TO RUN:
--    Run this file AFTER database.sql and sample-data.sql
--
--  NOTE ON "SET GLOBAL log_bin_trust_function_creators":
--    This line was removed because it requires SUPER/admin privilege
--    and fails on most cloud databases (Railway, Aiven, PlanetScale).
--    It is NOT needed here because all functions are already marked
--    DETERMINISTIC or READS SQL DATA — MySQL accepts them without it.
-- ============================================================

-- Select the database we want to work in
USE defaultdb;

-- ============================================================
-- WHAT IS DELIMITER $$?
--   Normally MySQL uses ";" to end a statement.
--   But inside functions/procedures we also use ";" for each line.
--   So we temporarily change the ending symbol to $$ so MySQL
--   knows where the whole block ends, not just one line.
--   At the end of the file we set it back to ";" with DELIMITER ;
-- ============================================================
DELIMITER $$


-- ============================================================
-- SECTION 1: STORED FUNCTIONS
-- ------------------------------------------------------------
-- A FUNCTION is a reusable block of code that:
--   • Takes input values (called parameters)
--   • Does some calculation or lookup
--   • Returns ONE value as the result
-- You can call a function anywhere inside a SELECT, SET, etc.
-- ============================================================


-- ------------------------------------------------------------
-- FUNCTION 1: calculate_gpa
-- ------------------------------------------------------------
-- PURPOSE:
--   Calculates a student's GPA (Grade Point Average) for one
--   semester. GPA is on a 0–10 scale, weighted by course credits.
--
-- HOW IT WORKS:
--   For each course the student has marks in:
--     Step 1: marks / max_marks  → gives a score between 0 and 1
--     Step 2: multiply by 10     → converts to 0–10 scale
--     Step 3: multiply by credits → heavier courses count more
--   Then divide the total by sum of credits → weighted average
--
-- INPUTS:
--   p_student_id  – the student's ID number
--   p_sem_id      – the semester ID
--
-- OUTPUT:
--   Returns a decimal number like 7.85 (the GPA)
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS calculate_gpa$$

CREATE FUNCTION calculate_gpa(
  p_student_id INT,   -- Input: which student?
  p_sem_id     INT    -- Input: which semester?
)
RETURNS DECIMAL(4,2)  -- Output: a number with 2 decimal places e.g. 8.75
DETERMINISTIC         -- Same inputs always give same output (no randomness)
READS SQL DATA        -- This function reads from tables but does NOT change them

BEGIN
  -- Declare a variable to hold the calculated GPA result
  DECLARE v_gpa DECIMAL(4,2) DEFAULT NULL;

  -- Calculate weighted GPA using marks and credit of each course
  -- SUM( score_per_course * credits ) / SUM( all credits )
  SELECT
    ROUND(
      SUM( (m.marks / m.max_marks) * 10 * c.credits )  -- weighted score total
      /
      SUM( c.credits ),                                  -- total credits
      2                                                  -- round to 2 decimals
    )
  INTO v_gpa                -- store the result into our variable
  FROM  marks m
  JOIN  courses c ON c.id = m.course_id   -- link marks to their course
  WHERE m.student_id = p_student_id       -- only this student
    AND c.sem_id     = p_sem_id           -- only this semester
    AND m.marks IS NOT NULL;              -- skip subjects with no marks yet

  -- Return the calculated GPA (will be NULL if no marks exist)
  RETURN v_gpa;

END$$


-- ------------------------------------------------------------
-- FUNCTION 2: get_pass_fail
-- ------------------------------------------------------------
-- PURPOSE:
--   Checks whether a student has PASSED or FAILED a semester,
--   or if results are still PENDING (marks not entered yet).
--
-- LOGIC:
--   PENDING  → no marks found at all
--   PASS     → the lowest mark in any subject is >= 40
--   FAIL     → at least one subject has marks < 40
--
-- INPUTS:
--   p_student_id  – the student's ID
--   p_sem_id      – the semester ID
--
-- OUTPUT:
--   Returns one of: 'PASS', 'FAIL', or 'PENDING'
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS get_pass_fail$$

CREATE FUNCTION get_pass_fail(
  p_student_id INT,   -- Input: which student?
  p_sem_id     INT    -- Input: which semester?
)
RETURNS VARCHAR(10)   -- Output: a short text word
DETERMINISTIC
READS SQL DATA

BEGIN
  -- Variables to store our findings
  DECLARE v_status    VARCHAR(10) DEFAULT 'PENDING'; -- default = not decided yet
  DECLARE v_min_marks DECIMAL(5,2);                  -- will hold lowest marks found
  DECLARE v_count     INT DEFAULT 0;                 -- how many mark records exist

  -- Count how many marks are entered AND find the lowest one
  SELECT
    COUNT(*),       -- total marks rows found
    MIN(m.marks)    -- the lowest marks value
  INTO
    v_count,        -- saved into v_count
    v_min_marks     -- saved into v_min_marks
  FROM  marks m
  JOIN  courses c ON c.id = m.course_id
  WHERE m.student_id = p_student_id
    AND c.sem_id     = p_sem_id
    AND m.marks IS NOT NULL;   -- only look at entered marks

  -- Decision logic:
  IF v_count = 0 THEN
    -- No marks entered at all → still pending
    SET v_status = 'PENDING';

  ELSEIF v_min_marks >= 40 THEN
    -- All subjects have marks >= 40 → student passed
    SET v_status = 'PASS';

  ELSE
    -- At least one subject has marks below 40 → failed
    SET v_status = 'FAIL';

  END IF;

  RETURN v_status;

END$$


-- ------------------------------------------------------------
-- FUNCTION 3: get_grade_letter
-- ------------------------------------------------------------
-- PURPOSE:
--   Converts a percentage score into a letter grade.
--   Example: 85.5% → 'A', 55% → 'C', 30% → 'F'
--
-- GRADE SCALE:
--   90% and above  → A+
--   80% – 89%      → A
--   70% – 79%      → B
--   60% – 69%      → C
--   40% – 59%      → D
--   Below 40%      → F (Fail)
--
-- INPUT:
--   p_pct  – the percentage value (e.g. 87.50)
--
-- OUTPUT:
--   Returns a letter grade string like 'A+', 'B', 'F'
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS get_grade_letter$$

CREATE FUNCTION get_grade_letter(
  p_pct DECIMAL(5,2)  -- Input: percentage marks (0 to 100)
)
RETURNS VARCHAR(2)    -- Output: grade letter (max 2 characters)
DETERMINISTIC         -- No randomness, same input = same output
NO SQL                -- Does not use any database tables at all

BEGIN
  -- CASE works like if/else: check each condition top to bottom
  RETURN CASE
    WHEN p_pct >= 90 THEN 'A+'   -- 90 and above
    WHEN p_pct >= 80 THEN 'A'    -- 80 to 89
    WHEN p_pct >= 70 THEN 'B'    -- 70 to 79
    WHEN p_pct >= 60 THEN 'C'    -- 60 to 69
    WHEN p_pct >= 40 THEN 'D'    -- 40 to 59
    ELSE                  'F'    -- below 40 = Fail
  END;

END$$


-- ============================================================
-- SECTION 2: STORED PROCEDURES
-- ------------------------------------------------------------
-- A PROCEDURE is a named block of code that:
--   • Takes input/output parameters
--   • Can run multiple queries, insert data, call other procedures
--   • Does NOT have to return a value (unlike a function)
-- You call a procedure using: CALL procedure_name(...)
-- ============================================================


-- ------------------------------------------------------------
-- PROCEDURE 1: sp_calculate_and_store_result
-- ------------------------------------------------------------
-- PURPOSE:
--   Calculates GPA and pass/fail status for one student in one
--   semester, then saves the result into the results table.
--   Also updates the student's overall CGPA (cumulative GPA).
--
-- WHEN IS IT CALLED?
--   • After a faculty enters or updates marks
--   • By triggers (auto-called when marks table changes)
--   • By the nightly scheduled event
--
-- INPUTS:
--   p_student_id  – which student
--   p_sem_id      – which semester
-- ------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_calculate_and_store_result$$

CREATE PROCEDURE sp_calculate_and_store_result(
  IN p_student_id INT,   -- Input: student ID
  IN p_sem_id     INT    -- Input: semester ID
)
BEGIN
  -- Local variables to hold intermediate results
  DECLARE v_gpa    DECIMAL(4,2);   -- will hold the calculated GPA
  DECLARE v_status VARCHAR(10);    -- will hold PASS / FAIL / PENDING

  -- Step 1: Call our helper functions to calculate GPA and status
  SET v_gpa    = calculate_gpa(p_student_id, p_sem_id);
  SET v_status = get_pass_fail(p_student_id, p_sem_id);

  -- Step 2: Save (or update) the result in the results table
  -- INSERT ... ON DUPLICATE KEY UPDATE means:
  --   "If a row already exists for this student+semester, UPDATE it.
  --    If not, INSERT a new row."
  INSERT INTO results (student_id, sem_id, gpa, pass_fail_status)
  VALUES (p_student_id, p_sem_id, v_gpa, v_status)
  ON DUPLICATE KEY UPDATE
    gpa              = v_gpa,             -- update GPA
    pass_fail_status = v_status,          -- update pass/fail
    generated_at     = CURRENT_TIMESTAMP; -- update timestamp

  -- Step 3: Recalculate and save the overall CGPA for this student
  -- CGPA = average GPA across ALL semesters
  INSERT INTO student_cgpa (student_id, cgpa)
  SELECT
    r.student_id,
    ROUND(AVG(r.gpa), 2)   -- average of all semester GPAs
  FROM results r
  WHERE r.student_id = p_student_id
    AND r.gpa IS NOT NULL  -- only semesters where GPA exists
  GROUP BY r.student_id
  ON DUPLICATE KEY UPDATE
    cgpa       = VALUES(cgpa),       -- update CGPA value
    updated_at = CURRENT_TIMESTAMP;  -- update timestamp

END$$


-- ------------------------------------------------------------
-- PROCEDURE 2: sp_recalculate_all_results
-- ------------------------------------------------------------
-- PURPOSE:
--   Goes through EVERY student in EVERY semester and recalculates
--   their results. Useful after bulk data imports or fixing errors.
--
-- HOW IT WORKS:
--   Uses a CURSOR — which is like a "for each row" loop in SQL.
--   It fetches one (student, semester) pair at a time and calls
--   sp_calculate_and_store_result for each one.
--
-- CALLED BY:
--   Admin "Recalculate All" button, or the nightly scheduled event
-- ------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_recalculate_all_results$$

CREATE PROCEDURE sp_recalculate_all_results()

BEGIN
  -- Variables for the loop
  DECLARE done     INT DEFAULT 0;   -- flag: 1 = no more rows to read
  DECLARE v_stu_id INT;             -- holds student_id from current row
  DECLARE v_sem_id INT;             -- holds sem_id from current row

  -- CURSOR: defines the set of rows we want to loop through
  -- Here we get every unique (student, semester) pair that has marks
  DECLARE cur CURSOR FOR
    SELECT DISTINCT m.student_id, c.sem_id
    FROM  marks m
    JOIN  courses c ON c.id = m.course_id
    WHERE m.marks IS NOT NULL;   -- only where marks have been entered

  -- CONTINUE HANDLER: when cursor runs out of rows, set done = 1
  -- This tells our loop to stop
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;

  -- Open the cursor (start reading)
  OPEN cur;

  -- Loop label so we can break out using LEAVE
  read_loop: LOOP

    -- Fetch the next row from the cursor into our variables
    FETCH cur INTO v_stu_id, v_sem_id;

    -- If no more rows (done = 1), exit the loop
    IF done THEN
      LEAVE read_loop;
    END IF;

    -- Process this student+semester combination
    CALL sp_calculate_and_store_result(v_stu_id, v_sem_id);

  END LOOP;

  -- Close the cursor (free memory)
  CLOSE cur;

  -- Return a success message to whoever called this procedure
  SELECT 'All results recalculated successfully.' AS status;

END$$


-- ------------------------------------------------------------
-- PROCEDURE 3: sp_enroll_student
-- ------------------------------------------------------------
-- PURPOSE:
--   Adds a new student to the system safely.
--   Validates that the department and semester exist before inserting.
--   Returns the newly created student ID as an output parameter.
--
-- INPUTS:
--   p_roll_no       – student's roll number (e.g. '2025CSE001')
--   p_name          – full name
--   p_email         – email address
--   p_password      – plain text password (stored for legacy support)
--   p_password_hash – hashed password (SHA256 hash, more secure)
--   p_dept_code     – department code like 'CSE', 'ECE'
--   p_sem_number    – semester number like 1, 2, 3
--   p_batch         – batch year like '2025'
--
-- OUTPUT:
--   p_new_id        – the auto-generated ID of the new student row
-- ------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_enroll_student$$

CREATE PROCEDURE sp_enroll_student(
  IN  p_roll_no       VARCHAR(30),   -- student roll number
  IN  p_name          VARCHAR(100),  -- student full name
  IN  p_email         VARCHAR(150),  -- email address
  IN  p_password      VARCHAR(255),  -- plain password
  IN  p_password_hash VARCHAR(64),   -- hashed password (SHA256)
  IN  p_dept_code     VARCHAR(20),   -- department code e.g. 'CSE'
  IN  p_sem_number    INT,           -- semester number e.g. 1
  IN  p_batch         VARCHAR(20),   -- batch year e.g. '2025'
  OUT p_new_id        INT            -- Output: new student's ID
)
BEGIN
  -- Variables to look up IDs from code/number
  DECLARE v_dept_id INT;   -- will hold department's ID
  DECLARE v_sem_id  INT;   -- will hold semester's ID

  -- Look up the department ID using the department code
  SELECT id INTO v_dept_id
  FROM departments
  WHERE dept_code = p_dept_code
  LIMIT 1;

  -- Look up the semester ID using the semester number
  SELECT id INTO v_sem_id
  FROM semesters
  WHERE sem_number = p_sem_number
  LIMIT 1;

  -- Validation: if department not found, stop and show error
  IF v_dept_id IS NULL THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Department code not found';
    -- SIGNAL = throw an error (like an exception in other languages)
    -- SQLSTATE '45000' = custom user-defined error code
  END IF;

  -- Validation: if semester not found, stop and show error
  IF v_sem_id IS NULL THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Semester number not found';
  END IF;

  -- All validations passed — now insert the new student record
  INSERT INTO students
    (roll_no, student_name, email, password, password_hash, dept_id, sem_id, batch)
  VALUES
    (p_roll_no, p_name, p_email, p_password, p_password_hash,
     v_dept_id, v_sem_id, p_batch);

  -- Return the auto-generated ID of the newly inserted student
  -- LAST_INSERT_ID() gives the ID of the most recent INSERT
  SET p_new_id = LAST_INSERT_ID();

END$$


-- ------------------------------------------------------------
-- PROCEDURE 4: sp_add_faculty
-- ------------------------------------------------------------
-- PURPOSE:
--   Adds a new faculty member to the system.
--   Validates that the department exists first.
--   Returns the new faculty ID as output.
--
-- INPUTS:
--   p_faculty_code  – unique faculty code e.g. 'FAC006'
--   p_name          – faculty full name
--   p_email         – email address
--   p_password      – plain text password
--   p_password_hash – hashed password
--   p_dept_code     – department code e.g. 'CSE'
--
-- OUTPUT:
--   p_new_id        – the newly created faculty row's ID
-- ------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_add_faculty$$

CREATE PROCEDURE sp_add_faculty(
  IN  p_faculty_code  VARCHAR(20),   -- unique faculty code
  IN  p_name          VARCHAR(100),  -- full name
  IN  p_email         VARCHAR(150),  -- email
  IN  p_password      VARCHAR(255),  -- plain password
  IN  p_password_hash VARCHAR(64),   -- hashed password
  IN  p_dept_code     VARCHAR(20),   -- department code
  OUT p_new_id        INT            -- Output: new faculty ID
)
BEGIN
  -- Variable to hold the found department ID
  DECLARE v_dept_id INT;

  -- Look up department ID from department code
  SELECT id INTO v_dept_id
  FROM departments
  WHERE dept_code = p_dept_code
  LIMIT 1;

  -- Validation: stop if department does not exist
  IF v_dept_id IS NULL THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Department code not found';
  END IF;

  -- Insert the new faculty record into the faculty table
  INSERT INTO faculty
    (faculty_code, faculty_name, email, password, password_hash, dept_id)
  VALUES
    (p_faculty_code, p_name, p_email, p_password, p_password_hash, v_dept_id);

  -- Return the auto-generated ID
  SET p_new_id = LAST_INSERT_ID();

END$$


-- ------------------------------------------------------------
-- PROCEDURE 5: sp_update_marks
-- ------------------------------------------------------------
-- PURPOSE:
--   Allows a faculty member to enter or update a student's marks.
--   Before saving, it checks that the faculty actually teaches
--   that course (authorization check).
--   After saving, it logs the action and recalculates results.
--
-- INPUTS:
--   p_faculty_id  – ID of the faculty entering marks
--   p_student_id  – ID of the student
--   p_course_id   – ID of the course
--   p_new_marks   – the marks value to save (e.g. 88.50)
--
-- CALLED BY: faculty marks entry page (marks.html)
-- ------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_update_marks$$

CREATE PROCEDURE sp_update_marks(
  IN p_faculty_id INT,            -- which faculty is entering marks
  IN p_student_id INT,            -- which student
  IN p_course_id  INT,            -- which course
  IN p_new_marks  DECIMAL(5,2)    -- the marks value
)
BEGIN
  -- Variables for authorization check and semester lookup
  DECLARE v_authorized INT DEFAULT 0;  -- 0 = not authorized yet
  DECLARE v_sem_id     INT;            -- semester of the course

  -- Step 1: Check if this faculty is allowed to enter marks for this course
  -- course_faculty_mapping table links faculty to their assigned courses
  SELECT COUNT(*) INTO v_authorized
  FROM course_faculty_mapping
  WHERE faculty_id = p_faculty_id
    AND course_id  = p_course_id;

  -- If count is 0, faculty is not assigned to this course → block them
  IF v_authorized = 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Faculty not authorised to update marks for this course';
  END IF;

  -- Step 2: Save the marks
  -- ON DUPLICATE KEY UPDATE = update if record exists, else insert new one
  INSERT INTO marks (student_id, course_id, marks, max_marks)
  VALUES (p_student_id, p_course_id, p_new_marks, 100)
  ON DUPLICATE KEY UPDATE
    marks      = p_new_marks,       -- update with new marks
    updated_at = CURRENT_TIMESTAMP; -- record the update time

  -- Step 3: Log this action in activity_log for audit trail
  INSERT INTO activity_log (faculty_id, student_id, course_id, new_marks)
  VALUES (p_faculty_id, p_student_id, p_course_id, p_new_marks);

  -- Step 4: Find which semester this course belongs to
  SELECT sem_id INTO v_sem_id
  FROM courses
  WHERE id = p_course_id
  LIMIT 1;

  -- Step 5: Recalculate GPA and pass/fail for the affected semester
  CALL sp_calculate_and_store_result(p_student_id, v_sem_id);

END$$


-- ------------------------------------------------------------
-- PROCEDURE 6: sp_get_student_transcript
-- ------------------------------------------------------------
-- PURPOSE:
--   Returns a student's complete academic transcript.
--   Shows every course, marks, percentage, grade, GPA, and CGPA.
--   Like a marksheet — all subjects across all semesters.
--
-- INPUT:
--   p_student_id  – the student whose transcript to fetch
--
-- CALLED BY: student dashboard, results page
-- ------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_get_student_transcript$$

CREATE PROCEDURE sp_get_student_transcript(
  IN p_student_id INT   -- Input: which student's transcript?
)
BEGIN
  -- Return one row per course with all relevant info
  SELECT
    s.sem_number,                                          -- semester number e.g. 3
    sem.sem_name,                                          -- semester name e.g. "Sem 3"
    c.course_code,                                         -- e.g. "CS301"
    c.course_name,                                         -- e.g. "Data Structures"
    c.credits,                                             -- credit weight of course
    m.marks,                                               -- actual marks obtained
    m.max_marks,                                           -- maximum possible marks
    ROUND((m.marks / m.max_marks) * 100, 2) AS percentage, -- marks as percentage
    get_grade_letter(
      (m.marks / m.max_marks) * 100
    )                                        AS grade,     -- letter grade A+/A/B/C/D/F
    r.gpa                                    AS sem_gpa,   -- GPA for that semester
    r.pass_fail_status,                                    -- PASS / FAIL / PENDING
    sc.cgpa                                                -- cumulative GPA overall
  FROM  marks m
  JOIN  courses      c   ON c.id  = m.course_id               -- link marks → course
  JOIN  semesters    s   ON s.id  = c.sem_id                  -- link course → semester
  JOIN  semesters    sem ON sem.id = c.sem_id                 -- same join for name
  JOIN  results      r   ON r.student_id = m.student_id
                        AND r.sem_id     = c.sem_id           -- link results
  LEFT JOIN student_cgpa sc ON sc.student_id = m.student_id  -- link CGPA (optional)
  WHERE m.student_id = p_student_id                           -- only this student
  ORDER BY s.sem_number, c.course_code;                       -- sort by semester then course

END$$


-- ------------------------------------------------------------
-- PROCEDURE 7: sp_department_performance_report
-- ------------------------------------------------------------
-- PURPOSE:
--   Shows a summary report for an entire department.
--   For each semester: how many students, average marks,
--   pass percentage, and average GPA.
--
-- INPUT:
--   p_dept_id  – the department ID (e.g. 1 for CSE)
--
-- CALLED BY: admin analytics dashboard
-- ------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_department_performance_report$$

CREATE PROCEDURE sp_department_performance_report(
  IN p_dept_id INT   -- Input: which department?
)
BEGIN
  SELECT
    sem.sem_name,                              -- semester name
    COUNT(DISTINCT m.student_id) AS total_students,  -- unique students with marks

    ROUND(AVG(m.marks), 2) AS avg_marks,       -- class average marks

    -- Pass % = (number of students with marks >= 40 / total) * 100
    ROUND(
      SUM(CASE WHEN m.marks >= 40 THEN 1 ELSE 0 END)
      / COUNT(m.id) * 100,
      2
    ) AS pass_pct,

    ROUND(AVG(r.gpa), 2) AS avg_gpa            -- average GPA for the semester

  FROM  marks m
  JOIN  courses   c   ON c.id   = m.course_id    -- link marks to course
  JOIN  semesters sem ON sem.id  = c.sem_id       -- link course to semester
  JOIN  students  st  ON st.id   = m.student_id   -- link marks to student
  LEFT JOIN results r ON r.student_id = m.student_id
                     AND r.sem_id     = c.sem_id   -- link to results (optional)

  WHERE st.dept_id  = p_dept_id    -- only students in this department
    AND m.marks IS NOT NULL        -- only where marks have been entered

  GROUP BY sem.sem_name, sem.sem_number   -- one row per semester
  ORDER BY sem.sem_number;                -- sorted by semester number

END$$


-- ============================================================
-- SECTION 3: TRIGGERS
-- ------------------------------------------------------------
-- A TRIGGER is a block of code that runs AUTOMATICALLY when
-- data in a table is inserted or updated.
-- You do NOT call a trigger manually — MySQL runs it for you.
--
-- Types used here:
--   BEFORE INSERT/UPDATE → runs BEFORE the data is saved
--   AFTER INSERT/UPDATE  → runs AFTER the data is saved
-- ============================================================


-- ------------------------------------------------------------
-- TRIGGER 1: trg_after_marks_insert
-- ------------------------------------------------------------
-- PURPOSE:
--   Automatically recalculates a student's result whenever
--   a NEW marks record is inserted.
--
-- WHY?
--   Without this, someone would have to manually run
--   sp_calculate_and_store_result after every marks entry.
--   This trigger does it automatically.
--
-- FIRES: AFTER a new row is INSERTed into the marks table
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_after_marks_insert$$

CREATE TRIGGER trg_after_marks_insert
AFTER INSERT ON marks       -- fires after every new row in marks
FOR EACH ROW                -- runs once per inserted row
BEGIN
  DECLARE v_sem_id INT;    -- variable to hold the semester ID

  -- Find which semester this course belongs to
  SELECT sem_id INTO v_sem_id
  FROM courses
  WHERE id = NEW.course_id  -- NEW.column = the value just inserted
  LIMIT 1;

  -- Only recalculate if we found a semester AND marks are not empty
  IF v_sem_id IS NOT NULL AND NEW.marks IS NOT NULL THEN
    CALL sp_calculate_and_store_result(NEW.student_id, v_sem_id);
  END IF;

END$$


-- ------------------------------------------------------------
-- TRIGGER 2: trg_after_marks_update
-- ------------------------------------------------------------
-- PURPOSE:
--   Same as above but for UPDATES to existing marks.
--   When a faculty corrects/changes marks, this auto-updates
--   the student's GPA and result immediately.
--
-- FIRES: AFTER an existing row in marks is UPDATEd
-- OLD.column = value before update
-- NEW.column = value after update
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_after_marks_update$$

CREATE TRIGGER trg_after_marks_update
AFTER UPDATE ON marks       -- fires after any update to marks table
FOR EACH ROW
BEGIN
  DECLARE v_sem_id INT;

  -- Only recalculate if the marks value actually changed
  -- (Avoids unnecessary recalculations if other columns changed)
  IF NEW.marks <> OLD.marks
  OR (NEW.marks IS NOT NULL AND OLD.marks IS NULL) THEN

    -- Find the semester for this course
    SELECT sem_id INTO v_sem_id
    FROM courses
    WHERE id = NEW.course_id
    LIMIT 1;

    -- Recalculate result if semester found
    IF v_sem_id IS NOT NULL THEN
      CALL sp_calculate_and_store_result(NEW.student_id, v_sem_id);
    END IF;

  END IF;

END$$


-- ------------------------------------------------------------
-- TRIGGER 3a: trg_prevent_marks_above_max_insert
-- ------------------------------------------------------------
-- PURPOSE:
--   Stops invalid marks from being inserted.
--   Rejects marks that are negative or exceed max_marks.
--
-- FIRES: BEFORE a new row is inserted into marks
--   (BEFORE = we can stop the insert before it happens)
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_prevent_marks_above_max_insert$$

CREATE TRIGGER trg_prevent_marks_above_max_insert
BEFORE INSERT ON marks      -- fires BEFORE insert, so we can block it
FOR EACH ROW
BEGIN
  -- Check: marks cannot be more than the maximum allowed
  IF NEW.marks IS NOT NULL AND NEW.marks > NEW.max_marks THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Marks cannot exceed max_marks';
    -- This SIGNAL cancels the INSERT and sends an error to the app
  END IF;

  -- Check: marks cannot be negative
  IF NEW.marks IS NOT NULL AND NEW.marks < 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Marks cannot be negative';
  END IF;

END$$


-- ------------------------------------------------------------
-- TRIGGER 3b: trg_prevent_marks_above_max_update
-- ------------------------------------------------------------
-- PURPOSE:
--   Same validation as above, but for UPDATE operations.
--   Prevents someone from changing marks to an invalid value.
--
-- FIRES: BEFORE a marks row is UPDATED
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_prevent_marks_above_max_update$$

CREATE TRIGGER trg_prevent_marks_above_max_update
BEFORE UPDATE ON marks      -- fires BEFORE update, so we can block it
FOR EACH ROW
BEGIN
  -- Reject if marks exceed maximum allowed
  IF NEW.marks IS NOT NULL AND NEW.marks > NEW.max_marks THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Marks cannot exceed max_marks';
  END IF;

  -- Reject negative marks
  IF NEW.marks IS NOT NULL AND NEW.marks < 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Marks cannot be negative';
  END IF;

END$$


-- ------------------------------------------------------------
-- TRIGGER 4: trg_log_faculty_marks_update
-- ------------------------------------------------------------
-- PURPOSE:
--   Automatically writes an audit log entry whenever any
--   marks are changed — even if changed directly via SQL
--   (not just through sp_update_marks procedure).
--   This is a "safety net" for activity logging.
--
-- WHY?
--   sp_update_marks already logs manually. But this trigger
--   catches direct SQL edits by admins or scripts too.
--
-- FIRES: AFTER a marks row is UPDATED
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_log_faculty_marks_update$$

CREATE TRIGGER trg_log_faculty_marks_update
AFTER UPDATE ON marks       -- fires after every marks update
FOR EACH ROW
BEGIN
  DECLARE v_faculty_id INT DEFAULT NULL;  -- will hold the faculty ID

  -- Find which faculty is assigned to teach this course
  -- (takes the first one if multiple faculty teach it)
  SELECT faculty_id INTO v_faculty_id
  FROM course_faculty_mapping
  WHERE course_id = NEW.course_id
  LIMIT 1;

  -- Only log if:
  --   1. A faculty is assigned to the course
  --   2. The marks value actually changed
  IF v_faculty_id IS NOT NULL AND
    (NEW.marks <> OLD.marks OR (NEW.marks IS NOT NULL AND OLD.marks IS NULL))
  THEN
    -- Insert a record into activity_log for audit purposes
    INSERT INTO activity_log (faculty_id, student_id, course_id, new_marks)
    VALUES (v_faculty_id, NEW.student_id, NEW.course_id, NEW.marks);
  END IF;

END$$


-- ============================================================
-- SECTION 4: SCHEDULED EVENT
-- ------------------------------------------------------------
-- An EVENT is a job that MySQL runs automatically on a schedule
-- (like a cron job). It does not need any manual trigger.
--
-- NOTE: SET GLOBAL event_scheduler = ON is removed here.
-- To enable the event scheduler, ask your DB admin to run:
--   SET GLOBAL event_scheduler = ON;
-- Or add to my.cnf: event_scheduler = ON
-- ============================================================


-- ------------------------------------------------------------
-- EVENT: evt_nightly_result_refresh
-- ------------------------------------------------------------
-- PURPOSE:
--   Every night at 2:00 AM, this event automatically recalculates
--   ALL student results and CGPA values across the entire system.
--
-- WHY?
--   Triggers handle individual mark changes in real time.
--   But this nightly job is a full "safety net" that catches any
--   edge cases — e.g. if a trigger was skipped during bulk imports.
--
-- SCHEDULE: Every 1 day, starting at 2:00 AM today
-- ------------------------------------------------------------
DROP EVENT IF EXISTS evt_nightly_result_refresh$$

CREATE EVENT evt_nightly_result_refresh
ON SCHEDULE EVERY 1 DAY                                    -- repeat every 24 hours
STARTS (TIMESTAMP(CURRENT_DATE) + INTERVAL 2 HOUR)        -- start at 2:00 AM today
DO
BEGIN
  -- Call the batch recalculation procedure for all students
  CALL sp_recalculate_all_results();
END$$


-- ============================================================
-- Restore the default statement delimiter back to semicolon
-- Everything after this line uses ";" normally again
-- ============================================================
DELIMITER ;


-- ============================================================
-- SECTION 5: VERIFICATION QUERIES
-- Run these after the file to confirm everything was created OK
-- ============================================================

-- List all stored functions and procedures in this database
SELECT ROUTINE_TYPE, ROUTINE_NAME
FROM   INFORMATION_SCHEMA.ROUTINES
WHERE  ROUTINE_SCHEMA = DATABASE()
ORDER  BY ROUTINE_TYPE, ROUTINE_NAME;

-- List all triggers in this database
SELECT TRIGGER_NAME, EVENT_MANIPULATION, EVENT_OBJECT_TABLE, ACTION_TIMING
FROM   INFORMATION_SCHEMA.TRIGGERS
WHERE  TRIGGER_SCHEMA = DATABASE()
ORDER  BY EVENT_OBJECT_TABLE;

-- List all scheduled events in this database
SELECT EVENT_NAME, STATUS, LAST_EXECUTED
FROM   INFORMATION_SCHEMA.EVENTS
WHERE  EVENT_SCHEMA = DATABASE();

-- Final confirmation message
SELECT '✅  PL/SQL objects created successfully!' AS status;


-- ============================================================
-- SECTION 6: USAGE EXAMPLES
-- These are commented out — remove /* and */ to run them
-- ============================================================

/*

-- Example 1: Calculate and save result for student 1, semester 1
CALL sp_calculate_and_store_result(1, 1);

-- Example 2: Recalculate results for ALL students in ALL semesters
CALL sp_recalculate_all_results();

-- Example 3: Enroll a new student
CALL sp_enroll_student(
  '2025CSE001',          -- roll number
  'Test Student',        -- name
  'test@student.edu',    -- email
  'pass123',             -- plain password
  SHA2('pass123', 256),  -- hashed password using SHA256
  'CSE',                 -- department code
  1,                     -- semester number
  '2025',                -- batch year
  @new_id                -- output: will contain new student's ID
);
SELECT @new_id;          -- show the newly created student ID

-- Example 4: Add a new faculty member
CALL sp_add_faculty(
  'FAC006',              -- faculty code
  'Dr. New Prof',        -- name
  'newprof@college.edu', -- email
  'fac123',              -- plain password
  SHA2('fac123', 256),   -- hashed password
  'CSE',                 -- department code
  @fac_id                -- output: new faculty ID
);
SELECT @fac_id;

-- Example 5: Faculty enters/updates marks for a student
-- Faculty ID 1 updates Student ID 1's marks in Course ID 1 to 88.50
CALL sp_update_marks(1, 1, 1, 88.50);

-- Example 6: Get full transcript for student ID 1
CALL sp_get_student_transcript(1);

-- Example 7: Department performance report for CSE (dept_id = 1)
CALL sp_department_performance_report(1);

-- Example 8: Use helper functions directly in a SELECT query
SELECT calculate_gpa(1, 1);          -- GPA for student 1 in semester 1
SELECT get_pass_fail(1, 1);          -- PASS/FAIL for student 1 in semester 1
SELECT get_grade_letter(87.5);       -- returns 'A' for 87.5%

*/