import express from 'express';
import { protect, adminOnly, selfOrAdmin } from '../middleware/auth.js';
import {
  getLoansByEmployee,
  getLoan,
  createLoan,
  addPayment,
  updateLoan,
  deleteLoan,
} from '../controllers/loanController.js';

const router = express.Router();

// Employee can view own loans, admin can view all
router.get('/:employeeId',              protect, selfOrAdmin, getLoansByEmployee);
router.get('/detail/:loanId',           protect, getLoan);

// Admin only
router.post('/:employeeId',             protect, adminOnly, createLoan);
router.post('/detail/:loanId/pay',      protect, adminOnly, addPayment);
router.put('/detail/:loanId',           protect, adminOnly, updateLoan);
router.delete('/detail/:loanId',        protect, adminOnly, deleteLoan);

export default router;