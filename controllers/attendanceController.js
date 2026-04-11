import AttendanceWeek from '../models/AttendanceWeek.js';
import Employee from '../models/Employee.js';
import Loan from '../models/Loan.js';
import {
  computeRates,
  computeDailyPay,
  computeOTPay,
  computeWeeklyTotals,
  applyLoanDeductions,
} from '../utils/computations.js';

export const getAttendanceByEmployee = async (req, res) => {
  try {
    const records = await AttendanceWeek.find({ employee: req.params.employeeId })
      .sort({ periodStart: -1 });
    res.json(records);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getAttendanceWeek = async (req, res) => {
  try {
    const record = await AttendanceWeek.findById(req.params.weekId)
      .populate('employee', 'name monthlyRate variableBonus hireDate');

    if (!record) return res.status(404).json({ message: 'Payslip not found' });

    // Attach computed rates as payslip header
    const { dailyRate, otRate4hrs, monthlyRestdayPay, grossMonthlyPay } =
      computeRates(record.employee.monthlyRate);

    res.json({
      ...record.toObject(),
      header: {
        employee:          record.employee.name,
        hireDate:          record.employee.hireDate,
        monthlyRate:       record.employee.monthlyRate,
        dailyRate,
        otRate4hrs,
        monthlyRestdayPay,
        variableBonus:     record.employee.variableBonus,
        grossMonthlyPay:   grossMonthlyPay + record.employee.variableBonus,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createAttendanceWeek = async (req, res) => {
  try {
    const { periodStart, periodEnd, days } = req.body;

    const employee = await Employee.findById(req.params.employeeId);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    const { hourlyRate } = computeRates(employee.monthlyRate);

    // Auto-compute dailyPay and overtime per day
    const computedDays = days.map(day => {
      const dailyPay = computeDailyPay(day.attendance, hourlyRate, day.hoursWorked || 8);
      const overtime = day.attendance === 'ot'
        ? computeOTPay(hourlyRate, day.otHours || 0)
        : 0;
      return { ...day, dailyPay, overtime };
    });

    const { totalDailyPay, totalOvertime, totalAdvances, netPay } =
      computeWeeklyTotals(computedDays);

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

    // FIFO loan deduction
    if (totalAdvances > 0) {
      const loans = await Loan.find({
        employee:  req.params.employeeId,
        isSettled: false,
      }).sort({ dateTaken: 1 });

      await applyLoanDeductions(loans, totalAdvances);
    }

    res.status(201).json(record);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const updateAttendanceWeek = async (req, res) => {
  try {
    const { days } = req.body;

    const record = await AttendanceWeek.findById(req.params.weekId)
      .populate('employee', 'monthlyRate');
    if (!record) return res.status(404).json({ message: 'Payslip not found' });

    if (days) {
      const { hourlyRate } = computeRates(record.employee.monthlyRate);

      const computedDays = days.map(day => {
        const dailyPay = computeDailyPay(day.attendance, hourlyRate, day.hoursWorked || 8);
        const overtime = day.attendance === 'ot'
          ? computeOTPay(hourlyRate, day.otHours || 0)
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

export const deleteAttendanceWeek = async (req, res) => {
  try {
    const record = await AttendanceWeek.findByIdAndDelete(req.params.weekId);
    if (!record) return res.status(404).json({ message: 'Payslip not found' });
    res.json({ message: 'Payslip deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};