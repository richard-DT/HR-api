import Loan from '../models/Loan.js';
import Employee from '../models/Employee.js';

// @desc    Get all loans of an employee
// @route   GET /api/loans/:employeeId
export const getLoansByEmployee = async (req, res) => {
  try {
    const loans = await Loan.find({ employee: req.params.employeeId })
      .sort({ dateTaken: -1 });
    res.json(loans);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single loan
// @route   GET /api/loans/detail/:loanId
export const getLoan = async (req, res) => {
  try {
    const loan = await Loan.findById(req.params.loanId)
      .populate('employee', 'name');
    if (!loan) return res.status(404).json({ message: 'Loan not found' });
    res.json(loan);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a loan
// @route   POST /api/loans/:employeeId
export const createLoan = async (req, res) => {
  try {
    const { dateTaken, principalAmount } = req.body;

    const employee = await Employee.findById(req.params.employeeId);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    const loan = await Loan.create({
      employee:        req.params.employeeId,
      dateTaken,
      principalAmount,
      // monthlyPayment,
      balance:         principalAmount, // balance starts at full amount
      payments:        [],
      isSettled:       false,
    });

    res.status(201).json(loan);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Add a monthly payment to a loan
// @route   POST /api/loans/detail/:loanId/pay
export const addPayment = async (req, res) => {
  try {
    const { month, amountPaid } = req.body;

    const loan = await Loan.findById(req.params.loanId);
    if (!loan) return res.status(404).json({ message: 'Loan not found' });

    if (loan.isSettled) {
      return res.status(400).json({ message: 'Loan is already fully settled.' });
    }

    // Deduct from balance
    loan.balance = loan.balance - amountPaid;

    // Add to payment history
    loan.payments.push({ month, amountPaid });

    // Auto-mark as settled if balance is 0 or less
    if (loan.balance <= 0) {
      loan.balance   = 0;
      loan.isSettled = true;
    }

    await loan.save();
    res.json(loan);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Update loan details (admin only)
// @route   PUT /api/loans/detail/:loanId
export const updateLoan = async (req, res) => {
  try {
    const loan = await Loan.findByIdAndUpdate(
      req.params.loanId,
      req.body,
      { new: true, runValidators: true }
    );
    if (!loan) return res.status(404).json({ message: 'Loan not found' });
    res.json(loan);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Delete a loan
// @route   DELETE /api/loans/detail/:loanId
export const deleteLoan = async (req, res) => {
  try {
    const loan = await Loan.findByIdAndDelete(req.params.loanId);
    if (!loan) return res.status(404).json({ message: 'Loan not found' });
    res.json({ message: 'Loan deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};