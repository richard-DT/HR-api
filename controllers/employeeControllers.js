import Employee from '../models/Employee.js';

// @desc    Get all employees
// @route   GET /api/employees
export const getEmployees = async (req, res) => {
  try {
    const employees = await Employee.find({ isActive: true }).sort({ name: 1 });
    res.json(employees);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single employee
// @route   GET /api/employees/:id
export const getEmployee = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });
    res.json(employee);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create employee
// @route   POST /api/employees
export const createEmployee = async (req, res) => {
  try {
    const { name, hireDate, position, monthlyRate, dailyRate, otRate4hrs, monthlyRestdayPay, variableBonus } = req.body;

    const employee = await Employee.create({
      name,
      hireDate,
      position,
      monthlyRate,
      dailyRate,
      otRate4hrs,
      monthlyRestdayPay: monthlyRestdayPay || 0,
      variableBonus: variableBonus || 0,
      // Automatically log the starting salary in history
      salaryHistory: [{
        effectiveDate: hireDate,
        monthlyRate,
        dailyRate,
        otRate4hrs,
        isCurrent: true,
      }],
    });

    res.status(201).json(employee);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Update employee basic info
// @route   PUT /api/employees/:id
export const updateEmployee = async (req, res) => {
  try {
    const employee = await Employee.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!employee) return res.status(404).json({ message: 'Employee not found' });
    res.json(employee);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Update salary rate (logs to history)
// @route   PUT /api/employees/:id/salary
export const updateSalary = async (req, res) => {
  try {
    const { effectiveDate, monthlyRate, dailyRate, otRate4hrs } = req.body;

    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    // Mark all previous salary history as not current
    employee.salaryHistory.forEach(h => h.isCurrent = false);

    // Push new salary to history
    employee.salaryHistory.push({
      effectiveDate,
      monthlyRate,
      dailyRate,
      otRate4hrs,
      isCurrent: true,
    });

    // Update current rates on employee doc
    employee.monthlyRate = monthlyRate;
    employee.dailyRate   = dailyRate;
    employee.otRate4hrs  = otRate4hrs;

    await employee.save();
    res.json(employee);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Soft delete (deactivate) employee
// @route   DELETE /api/employees/:id
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