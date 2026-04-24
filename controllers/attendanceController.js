import AttendanceWeek from '../models/AttendanceWeek.js';
import Employee from '../models/Employee.js';
import Loan from '../models/Loan.js';
import {
  computeRates,
  computeDailyPay,
  computeOTPay,
  computeWeeklyTotals,
} from '../utils/computations.js';

// Helper — get actual date from periodStart + day index
const getActualDate = (periodStart, dayIndex) => {
  const date = new Date(periodStart);
  date.setDate(date.getDate() + dayIndex);
  return date;
};

// Helper — validate Tuesday
const isTuesday = (date) => {
  return new Date(date).getDay() === 2;
};

// Helper — FIFO loan deduction per day entry
const applyLoanDeductionPerDay = async (employeeId, amount, paymentDate) => {
  const loans = await Loan.find({
    employee:  employeeId,
    isSettled: false,
  }).sort({ dateTaken: 1 }); // oldest first

  let remaining = amount;

  for (const loan of loans) {
    if (remaining <= 0) break;

    const payment = { month: paymentDate, amountPaid: 0 };

    if (remaining >= loan.balance) {
      payment.amountPaid = loan.balance;
      remaining          = remaining - loan.balance;
      loan.balance       = 0;
      loan.isSettled     = true;
    } else {
      payment.amountPaid = remaining;
      loan.balance       = loan.balance - remaining;
      remaining          = 0;
    }

    loan.payments.push(payment);
    await loan.save();
  }
};

// @desc    Get all payslips of an employee
// @route   GET /api/attendance/:employeeId
// export const getAttendanceByEmployee = async (req, res) => {
//   try {
//     const records = await AttendanceWeek.find({ employee: req.params.employeeId })
//       .sort({ periodStart: -1 });
//     res.json(records);
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };

export const getAttendanceByEmployee = async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin'

    // Admin sees all, employee sees published only
    const filter = {
      employee: req.params.employeeId,
      ...(isAdmin ? {} : { isPublished: true }),
    }

    const records = await AttendanceWeek.find(filter)
      .sort({ periodStart: -1 });
    res.json(records);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single payslip
// @route   GET /api/attendance/week/:weekId
export const getAttendanceWeek = async (req, res) => {
  try {
    const record = await AttendanceWeek.findById(req.params.weekId)
      .populate('employee', 'name monthlyRate variableBonus hireDate');

    if (!record) return res.status(404).json({ message: 'Payslip not found' });

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

// @desc    Create weekly payslip
// @route   POST /api/attendance/:employeeId
export const createAttendanceWeek = async (req, res) => {
  try {
    const { periodStart, days } = req.body;

    // Validate Tuesday
    if (!isTuesday(periodStart)) {
      return res.status(400).json({ message: 'Period start must be a Tuesday.' });
    }

    const employee = await Employee.findById(req.params.employeeId);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    // Auto-compute periodEnd (Monday = periodStart + 6 days)
    const periodEnd = new Date(periodStart);
    periodEnd.setDate(periodEnd.getDate() + 6);

    const { hourlyRate } = computeRates(employee.monthlyRate);

    // Auto-compute dailyPay and overtime per day + attach actual date
    const computedDays = days.map((day, index) => {
      const dailyPay  = computeDailyPay(day.attendance, hourlyRate, day.hoursWorked ?? 8);
      const overtime  = day.attendance === 'ot'
        ? computeOTPay(hourlyRate, day.otHours || 0)
        : 0;
      const actualDate = getActualDate(periodStart, index);

      return { ...day, dailyPay, overtime, actualDate };
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

    // Per day FIFO loan deduction — only if remarks === 'loan'
    for (let i = 0; i < computedDays.length; i++) {
      const day = computedDays[i];
      if (day.advances > 0 && day.remarks?.toLowerCase() === 'loan') {
        await applyLoanDeductionPerDay(
          req.params.employeeId,
          day.advances,
          day.actualDate
        );
      }
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
    const { days } = req.body;

    const record = await AttendanceWeek.findById(req.params.weekId)
      .populate('employee', 'monthlyRate');
    if (!record) return res.status(404).json({ message: 'Payslip not found' });

    if (days) {
      const { hourlyRate } = computeRates(record.employee.monthlyRate);

      const computedDays = days.map((day, index) => {
        const dailyPay   = computeDailyPay(day.attendance, hourlyRate, day.hoursWorked ?? 8);
        const overtime   = day.attendance === 'ot'
          ? computeOTPay(hourlyRate, day.otHours || 0)
          : 0;
        const actualDate = getActualDate(record.periodStart, index);

        return { ...day, dailyPay, overtime, actualDate };
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

// @desc    Toggle publish status of a payslip
// @route   PUT /api/attendance/week/:weekId/publish
export const togglePublish = async (req, res) => {
  try {
    const record = await AttendanceWeek.findById(req.params.weekId)
    if (!record) return res.status(404).json({ message: 'Payslip not found' })

    record.isPublished = !record.isPublished
    await record.save()

    res.json({
      message:     `Payslip ${record.isPublished ? 'published' : 'unpublished'} successfully`,
      isPublished: record.isPublished,
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}