import AttendanceWeek from '../models/AttendanceWeek.js';
import Employee from '../models/Employee.js';

// @desc    Get all payslips of an employee
// @route   GET /api/attendance/:employeeId
export const getAttendanceByEmployee = async (req, res) => {
  try {
    const records = await AttendanceWeek.find({ employee: req.params.employeeId })
      .sort({ periodStart: -1 }); // pinakabago muna
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
    const { periodStart, periodEnd, days } = req.body;

    const employee = await Employee.findById(req.params.employeeId);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    // Compute totals from days array
    const totalDailyPay = days.reduce((sum, d) => sum + (d.dailyPay || 0), 0);
    const totalOvertime = days.reduce((sum, d) => sum + (d.overtime || 0), 0);
    const totalAdvances = days.reduce((sum, d) => sum + (d.advances || 0), 0);
    const netPay        = totalDailyPay + totalOvertime - totalAdvances;

    const record = await AttendanceWeek.create({
      employee:     req.params.employeeId,
      periodStart,
      periodEnd,
      days,
      totalDailyPay,
      totalOvertime,
      totalAdvances,
      netPay,
    });

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

    const record = await AttendanceWeek.findById(req.params.weekId);
    if (!record) return res.status(404).json({ message: 'Payslip not found' });

    // Recompute totals if days are updated
    if (days) {
      record.days          = days;
      record.totalDailyPay = days.reduce((sum, d) => sum + (d.dailyPay || 0), 0);
      record.totalOvertime = days.reduce((sum, d) => sum + (d.overtime || 0), 0);
      record.totalAdvances = days.reduce((sum, d) => sum + (d.advances || 0), 0);
      record.netPay        = record.totalDailyPay + record.totalOvertime - record.totalAdvances;
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