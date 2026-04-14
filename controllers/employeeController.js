import Employee from '../models/Employee.js';
import { computeRates } from '../utils/computations.js';
import AttendanceWeek from '../models/AttendanceWeek.js';

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

    const employee = await Employee.findById(id)
    if (!employee) return res.status(404).json({ message: 'Employee not found' })

    // Get all payslips for the year
    const startOfYear = new Date(`${year}-01-01`)
    const endOfYear   = new Date(`${year}-12-31`)

    const payslips = await AttendanceWeek.find({
      employee:    id,
      periodStart: { $lte: endOfYear },
      periodEnd:   { $gte: startOfYear },
    }).sort({ periodStart: 1 })

    // Get salary history para malaman ang rate per month
    const salaryHistory = employee.salaryHistory.sort(
      (a, b) => new Date(a.effectiveDate) - new Date(b.effectiveDate)
    )

    // Helper — get monthly rate during a specific date
    const getRateForDate = (date) => {
      let rate = salaryHistory[0]?.monthlyRate || employee.monthlyRate
      for (const h of salaryHistory) {
        if (new Date(h.effectiveDate) <= new Date(date)) {
          rate = h.monthlyRate
        }
      }
      return rate
    }

    // Process per month (Jan=0 to Dec=11)
    const months = []
    let ytdTotal = 0

    for (let month = 0; month < 12; month++) {
      const monthStart = new Date(year, month, 1)
      const monthEnd   = new Date(year, month + 1, 0) // last day of month

      // Skip future months
      if (monthStart > new Date()) break

      // Get payslips that overlap this month
      const monthPayslips = payslips.filter(p => {
        const pStart = new Date(p.periodStart)
        const pEnd   = new Date(p.periodEnd)
        return pStart <= monthEnd && pEnd >= monthStart
      })

      // Count days per attendance type
      let presentDays = 0
      let absentDays  = 0
      let otDays      = 0
      let partialDays = 0
      let slDays      = 0
      let vlDays      = 0
      let restDays    = 0

      for (const payslip of monthPayslips) {
        for (const day of payslip.days) {
          // Only count days that fall within this month
          const dayDate = new Date(year, month, day.dayNumber)
          if (dayDate < monthStart || dayDate > monthEnd) continue

          switch (day.attendance) {
            case 'present': presentDays++; break
            case 'ot':      presentDays++; otDays++; break
            case 'partial': presentDays++; partialDays++; break
            case 'absent':  absentDays++;  break
            case 'sl':      absentDays++;  slDays++; break
            case 'vl':      absentDays++;  vlDays++; break
            case 'rest':    restDays++;    break
          }
        }
      }

      const totalWorkingDays = presentDays + absentDays
      const monthlyRate      = getRateForDate(monthStart)

      // Compute 13th month share for this month
      const share = totalWorkingDays > 0
        ? (presentDays / totalWorkingDays) * monthlyRate / 12
        : 0

      ytdTotal += share

      months.push({
        month:          month + 1,
        monthName:      monthStart.toLocaleString('en-PH', { month: 'long' }),
        presentDays,
        absentDays,
        otDays,
        partialDays,
        slDays,
        vlDays,
        restDays,
        totalWorkingDays,
        monthlyRate,
        share:          parseFloat(share.toFixed(2)),
        hasData:        monthPayslips.length > 0,
      })
    }

    res.json({
      employee: {
        id:   employee._id,
        name: employee.name,
      },
      year:     parseInt(year),
      months,
      ytdTotal: parseFloat(ytdTotal.toFixed(2)),
    })

  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}