import express from 'express';
import { protect, adminOnly } from '../middleware/auth.js';
import {
  getEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  updateSalary,
  deleteEmployee,
  get13thMonth,
  getEmployeeSummary,
} from '../controllers/employeeController.js';

const router = express.Router();

router.get('/',                    protect, adminOnly, getEmployees);
router.get('/:id',                 protect, getEmployee);
router.post('/',                   protect, adminOnly, createEmployee);
router.put('/:id',                 protect, adminOnly, updateEmployee);
router.put('/:id/salary',          protect, adminOnly, updateSalary);
router.delete('/:id',              protect, adminOnly, deleteEmployee);
router.get('/:id/13thmonth/:year', protect, get13thMonth);
router.get('/:id/summary', protect, adminOnly, getEmployeeSummary);

export default router;