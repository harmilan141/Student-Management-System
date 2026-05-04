# 🎓 Student Management System

This project includes:

- Role-based login frontend
- Node.js + Express backend
- MySQL database

## 🌐 Live Project

👉 https://student-management-system-en7r.onrender.com/

---

## 1. Run the SQL first

Open MySQL Workbench and run:

- database.sql

This creates:

- database: `defaultdb`
- tables: `admins`, `students`, `faculty`, `courses`, `marks`, `semester_results` and related mappings

### Sample users:
- `harmilan_admin / admin123`
- `STU101 / student123`
- `FAC301 / faculty123`

---

## 2. Configure environment

Create a `.env` file from `.env.example` and add your Aiven MySQL credentials.

---

## 3. Install packages

```bash
npm install
