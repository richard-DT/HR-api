import Employee from '../models/Employee.js';
import { computeRates } from '../utils/computations.js';
import AttendanceWeek from '../models/AttendanceWeek.js';
import Loan from '../models/Loan.js';

export const getEmployees = async (req, res) => {
  try {
    const employees = await Employee.find({ isActive: true }).sort({ name: 1 });

    // Attach computed rates to each employee
    const data = employees.map(emp => ({
      ...emp.toObject(),
      ...computeRates(emp.monthlyRate),
    }));

    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getEmployee = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    res.json({
      ...employee.toObject(),
      ...computeRates(employee.monthlyRate),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createEmployee = async (req, res) => {
  try {
    const { name, hireDate, position, monthlyRate, variableBonus } = req.body;

    const employee = await Employee.create({
      name,
      hireDate,
      position,
      monthlyRate,
      variableBonus: variableBonus || 0,
      salaryHistory: [{
        effectiveDate: hireDate,
        monthlyRate,
        isCurrent: true,
      }],
    });

    res.status(201).json({
      ...employee.toObject(),
      ...computeRates(monthlyRate),
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const updateEmployee = async (req, res) => {
  try {
    const employee = await Employee.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    res.json({
      ...employee.toObject(),
      ...computeRates(employee.monthlyRate),
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const updateSalary = async (req, res) => {
  try {
    const { effectiveDate, monthlyRate } = req.body;

    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    employee.salaryHistory.forEach(h => h.isCurrent = false);
    employee.salaryHistory.push({ effectiveDate, monthlyRate, isCurrent: true });
    employee.monthlyRate = monthlyRate;

    await employee.save();

    res.json({
      ...employee.toObject(),
      ...computeRates(monthlyRate),
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteEmployee = async (req, res) => {
  try {
    const employee = await Employee.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!employee) return res.status(404).json({ message: 'Employee not found' });
    res.json({ message: `${employee.name} has been deactivated.` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get 13th month computation per year
// @route   GET /api/employees/:id/13thmonth/:year
export const get13thMonth = async (req, res) => {
  try {
    const { id, year } = req.params
    const yearInt = parseInt(year)

    const employee = await Employee.findById(id)
    if (!employee) return res.status(404).json({ message: 'Employee not found' })

    // Dec 1 last year → Nov 30 this year
    const periodStart = new Date(yearInt - 1, 11, 1)  // Dec 1 last year
    const periodEnd   = new Date(yearInt, 10, 30)      // Nov 30 this year

    const payslips = await AttendanceWeek.find({
      employee:    id,
      periodStart: { $lte: periodEnd },
      periodEnd:   { $gte: periodStart },
    }).sort({ periodStart: 1 })

    const salaryHistory = [...employee.salaryHistory].sort(
      (a, b) => new Date(a.effectiveDate) - new Date(b.effectiveDate)
    )

    const getRateForDate = (date) => {
      let rate = salaryHistory[0]?.monthlyRate || employee.monthlyRate
      for (const h of salaryHistory) {
        if (new Date(h.effectiveDate) <= new Date(date)) rate = h.monthlyRate
      }
      return rate
    }

    // 12 months: Dec last year → Nov this year
    const monthSequence = [
      { month: 12, year: yearInt - 1 }, // December last year
      { month: 1,  year: yearInt },     // January this year
      { month: 2,  year: yearInt },
      { month: 3,  year: yearInt },
      { month: 4,  year: yearInt },
      { month: 5,  year: yearInt },
      { month: 6,  year: yearInt },
      { month: 7,  year: yearInt },
      { month: 8,  year: yearInt },
      { month: 9,  year: yearInt },
      { month: 10, year: yearInt },
      { month: 11, year: yearInt },     // November this year
    ]

    const months = []
    let ytdTotal  = 0

    for (const { month, year: monthYear } of monthSequence) {
      const monthStart = new Date(monthYear, month - 1, 1)
      const monthEnd   = new Date(monthYear, month, 0) // last day of month

      // Skip future months
      if (monthStart > new Date()) break

      // Get payslips that overlap this month
      const monthPayslips = payslips.filter(p => {
        const pStart = new Date(p.periodStart)
        const pEnd   = new Date(p.periodEnd)
        return pStart <= monthEnd && pEnd >= monthStart
      })

      let presentDays = 0
      let absentDays  = 0
      let otDays      = 0
      let partialDays = 0
      let slDays      = 0
      let vlDays      = 0
      let restDays    = 0

      for (const payslip of monthPayslips) {
        for (const day of payslip.days) {
          const actualDate = new Date(payslip.periodStart)
          actualDate.setDate(actualDate.getDate() + payslip.days.indexOf(day))

          if (actualDate < monthStart || actualDate > monthEnd) continue

          switch (day.attendance) {
            case 'present': presentDays++; break
            case 'ot':      presentDays++; otDays++; break
            case 'partial': presentDays++; partialDays++; break
            case 'absent':  absentDays++; break
            case 'sl':      absentDays++; slDays++; break
            case 'vl':      absentDays++; vlDays++; break
            case 'rest':    restDays++; break
          }
        }
      }

      const totalWorkingDays = presentDays + absentDays
      const monthlyRate      = getRateForDate(monthStart)
      const share = totalWorkingDays > 0
        ? (presentDays / totalWorkingDays) * monthlyRate / 12
        : 0

      ytdTotal += share

      months.push({
        month,
        year:            monthYear,
        monthName:       monthStart.toLocaleString('en-PH', { month: 'long' }),
        fullMonthName:   `${monthStart.toLocaleString('en-PH', { month: 'long' })} ${monthYear}`,
        presentDays,
        absentDays,
        otDays,
        partialDays,
        slDays,
        vlDays,
        restDays,
        totalWorkingDays,
        monthlyRate,
        share:           parseFloat(share.toFixed(2)),
        hasData:         monthPayslips.length > 0,
      })
    }

    res.json({
      employee: { id: employee._id, name: employee.name },
      year:     yearInt,
      period:   `Dec ${yearInt - 1} — Nov ${yearInt}`,
      months,
      ytdTotal: parseFloat(ytdTotal.toFixed(2)),
    })

  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// @desc    Get employee summary (KPIs)
// @route   GET /api/employees/:id/summary
export const getEmployeeSummary = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id)
    if (!employee) return res.status(404).json({ message: 'Employee not found' })

    const { dailyRate, otRate4hrs, monthlyRestdayPay, grossMonthlyPay } =
      computeRates(employee.monthlyRate)

    // Total active loans + balance
    const loans = await Loan.find({ employee: req.params.id })
    const totalLoanBalance = loans
      .filter(l => !l.isSettled)
      .reduce((sum, l) => sum + l.balance, 0)
    const activeLoans = loans.filter(l => !l.isSettled).length

    // YTD 13th month + attendance
    const year        = new Date().getFullYear()
    const periodStart = new Date(year - 1, 11, 1)  // Dec 1 last year
    const periodEnd   = new Date(year, 10, 30)      // Nov 30 this year

    const payslips = await AttendanceWeek.find({
      employee:    req.params.id,
      periodStart: { $lte: periodEnd },
      periodEnd:   { $gte: periodStart },
    })
    
    const salaryHistory = employee.salaryHistory.sort(
      (a, b) => new Date(a.effectiveDate) - new Date(b.effectiveDate)
    )

    const getRateForDate = (date) => {
      let rate = salaryHistory[0]?.monthlyRate || employee.monthlyRate
      for (const h of salaryHistory) {
        if (new Date(h.effectiveDate) <= new Date(date)) rate = h.monthlyRate
      }
      return rate
    }

    let ytd13thMonth    = 0
    let ytdPresent      = 0
    let ytdWorkingDays  = 0

    // Palitan ng:
    const monthSequence = [
      { month: 12, year: year - 1 },
      { month: 1,  year: year },
      { month: 2,  year: year },
      { month: 3,  year: year },
      { month: 4,  year: year },
      { month: 5,  year: year },
      { month: 6,  year: year },
      { month: 7,  year: year },
      { month: 8,  year: year },
      { month: 9,  year: year },
      { month: 10, year: year },
      { month: 11, year: year },
    ]

    for (const { month, year: monthYear } of monthSequence) {
      const monthStart = new Date(monthYear, month - 1, 1)
      const monthEnd   = new Date(monthYear, month, 0)

      if (monthStart > new Date()) break

      const monthPayslips = payslips.filter(p => {
        const pStart = new Date(p.periodStart)
        const pEnd   = new Date(p.periodEnd)
        return pStart <= monthEnd && pEnd >= monthStart
      })

      let presentDays = 0
      let absentDays  = 0

      for (const payslip of monthPayslips) {
        for (const day of payslip.days) {
          const actualDate = new Date(payslip.periodStart)
          actualDate.setDate(actualDate.getDate() + payslip.days.indexOf(day))
          if (actualDate < monthStart || actualDate > monthEnd) continue

          switch (day.attendance) {
            case 'present':
            case 'ot':
            case 'partial': presentDays++; break
            case 'absent':
            case 'sl':
            case 'vl':      absentDays++; break
          }
        }
      }

      const totalWorkingDays = presentDays + absentDays
      const monthlyRate      = getRateForDate(monthStart)
      const share = totalWorkingDays > 0
        ? (presentDays / totalWorkingDays) * monthlyRate / 12
        : 0

      ytd13thMonth   += share
      ytdPresent     += presentDays
      ytdWorkingDays += totalWorkingDays
    }

    const attendanceRate = ytdWorkingDays > 0
      ? ((ytdPresent / ytdWorkingDays) * 100).toFixed(1)
      : 0

    res.json({
      ...employee.toObject(),
      dailyRate,
      otRate4hrs,
      monthlyRestdayPay,
      grossMonthlyPay,
      totalLoanBalance:  parseFloat(totalLoanBalance.toFixed(2)),
      activeLoans,
      ytd13thMonth:      parseFloat(ytd13thMonth.toFixed(2)),
      attendanceRate:    parseFloat(attendanceRate),
      year,
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}