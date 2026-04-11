import express from 'express';
import { protect, adminOnly, selfOrAdmin } from '../middleware/auth.js';
import {
  getAttendanceByEmployee,
  getAttendanceWeek,
  createAttendanceWeek,
  updateAttendanceWeek,
  deleteAttendanceWeek,
} from '../controllers/attendanceController.js';

const router = express.Router();

// Employee can view own records, admin can view all
router.get('/:employeeId',       protect, selfOrAdmin, getAttendanceByEmployee);
router.get('/week/:weekId',      protect, getAttendanceWeek);

// Admin only
router.post('/:employeeId',      protect, adminOnly, createAttendanceWeek);
router.put('/week/:weekId',      protect, adminOnly, updateAttendanceWeek);
router.delete('/week/:weekId',   protect, adminOnly, deleteAttendanceWeek);

export default router;