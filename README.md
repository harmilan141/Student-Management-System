# Student Management System

This project includes:

- Role-based login frontend
- Node.js + Express backend
- MySQL database script

## 1. Run the SQL first

Open MySQL Workbench and run:

- [database.sql](C:/Users/Lenovo/OneDrive/Documents/New%20project/database.sql)

This creates:

- database: `defaultdb`
- tables: `admins`, `students`, `faculty`, `courses`, `marks`, `semester_results` and related mappings
- sample users:
  - `harmilan_admin / admin123`
  - `STU101 / student123`
  - `FAC301 / faculty123`

## 2. Configure environment

Create a `.env` file from `.env.example` and add your Aiven MySQL credentials.

## 3. Install packages

```bash
npm install
```

## 4. Start server

```bash
npm start
```

Then open:

```text
http://localhost:3000
```
