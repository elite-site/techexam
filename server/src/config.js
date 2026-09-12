require('dotenv').config();
const path = require('path');

module.exports = {
  port: parseInt(process.env.PORT || '5000', 10),
  databaseUrl: process.env.DATABASE_URL,
  jwtStudentSecret: process.env.JWT_STUDENT_SECRET || 'student_secret',
  jwtAdminSecret: process.env.JWT_ADMIN_SECRET || 'admin_secret',
  adminUsername: process.env.ADMIN_USERNAME || 'ADMIN',
  adminPassword: process.env.ADMIN_PASSWORD || 'ADMIN123',
  excelPath: path.resolve(__dirname, '..', process.env.EXCEL_PATH || '../Combined Student List.xlsx'),
  quizRound1Path: process.env.QUIZ_ROUND1_PATH || '../Technical Quiz (First Round).txt',
  debugPath: process.env.DEBUG_PATH || '../debugquestion.txt',
  resolveRel: (p) => path.resolve(__dirname, '..', p),
};