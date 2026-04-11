import Employee from '../models/Employee.js';
import { computeRates } from '../utils/computations.js';

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