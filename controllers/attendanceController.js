import AttendanceWeek from '../models/AttendanceWeek.js';
import Employee from '../models/Employee.js';
import Loan from '../models/Loan.js';
import {
  computeDailyPay,
  computeOTPay,
  computeWeeklyTotals,
  applyLoanDeductions,
} from '../utils/computations.js';

// @desc    Get all payslips of an employee
// @route   GET /api/attendance/:employeeId
export const getAttendanceByEmployee = async (req, res) => {
  try {
    const records = await AttendanceWeek.find({ employee: req.params.employeeId })
      .sort({ periodStart: -1 });
    res.json(records);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single payslip/week
// @route   GET /api/attendance/week/:weekId
export const getAttendanceWeek = async (req, res) => {
  try {
    const record = await AttendanceWeek.findById(req.params.weekId)
      .populate('employee', 'name dailyRate otRate4hrs');
    if (!record) return res.status(404).json({ message: 'Payslip not found' });
    res.json(record);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create weekly payslip
// @route   POST /api/attendance/:employeeId
export const createAttendanceWeek = async (req, res) => {
  try {
    const { periodStart, periodEnd, days, otHours = 4 } = req.body;

    const employee = await Employee.findById(req.params.employeeId);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    // Auto-compute dailyPay and overtime per day
    const computedDays = days.map(day => {
      const dailyPay = computeDailyPay(day.attendance, employee.dailyRate);
      const overtime = day.attendance === 'ot'
        ? computeOTPay(employee.dailyRate, day.otHours || otHours)
        : 0;

      return { ...day, dailyPay, overtime };
    });

    // Compute weekly totals
    const { totalDailyPay, totalOvertime, totalAdvances, netPay } =
      computeWeeklyTotals(computedDays);

    // Create the payslip
    const record = await AttendanceWeek.create({
      employee: req.params.employeeId,
      periodStart,
      periodEnd,
      days: computedDays,
      totalDailyPay,
      totalOvertime,
      totalAdvances,
      netPay,
    });

    // Apply FIFO loan deductions if may advances
    if (totalAdvances > 0) {
      const loans = await Loan.find({
        employee:  req.params.employeeId,
        isSettled: false,
      }).sort({ dateTaken: 1 }); // oldest first = FIFO

      await applyLoanDeductions(loans, totalAdvances);
    }

    res.status(201).json(record);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Update a weekly payslip
// @route   PUT /api/attendance/week/:weekId
export const updateAttendanceWeek = async (req, res) => {
  try {
    const { days, otHours = 4 } = req.body;

    const record = await AttendanceWeek.findById(req.params.weekId)
      .populate('employee', 'dailyRate');
    if (!record) return res.status(404).json({ message: 'Payslip not found' });

    if (days) {
      // Recompute days
      const computedDays = days.map(day => {
        const dailyPay = computeDailyPay(day.attendance, record.employee.dailyRate);
        const overtime = day.attendance === 'ot'
          ? computeOTPay(record.employee.dailyRate, day.otHours || otHours)
          : 0;
        return { ...day, dailyPay, overtime };
      });

      const { totalDailyPay, totalOvertime, totalAdvances, netPay } =
        computeWeeklyTotals(computedDays);

      record.days          = computedDays;
      record.totalDailyPay = totalDailyPay;
      record.totalOvertime = totalOvertime;
      record.totalAdvances = totalAdvances;
      record.netPay        = netPay;
    }

    await record.save();
    res.json(record);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Delete a weekly payslip
// @route   DELETE /api/attendance/week/:weekId
export const deleteAttendanceWeek = async (req, res) => {
  try {
    const record = await AttendanceWeek.findByIdAndDelete(req.params.weekId);
    if (!record) return res.status(404).json({ message: 'Payslip not found' });
    res.json({ message: 'Payslip deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};