import express from 'express';
import { protect, adminOnly } from '../middleware/auth.js';
import {
  getEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  updateSalary,
  deleteEmployee,
} from '../controllers/employeeControllers.js';

const router = express.Router();

router.get('/',        protect, adminOnly, getEmployees);
router.get('/:id',     protect, getEmployee);
router.post('/',       protect, adminOnly, createEmployee);
router.put('/:id',     protect, adminOnly, updateEmployee);
router.put('/:id/salary', protect, adminOnly, updateSalary);   // ← separate route para sa salary update
router.delete('/:id',  protect, adminOnly, deleteEmployee);

export default router;