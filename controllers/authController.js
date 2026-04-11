import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

// @desc    Login
// @route   POST /api/auth/login
export const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username, isActive: true }).populate('employee', 'name');
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const isMatch = await user.matchPassword(password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

    res.json({
      token: generateToken(user._id),
      user: {
        id:       user._id,
        name:     user.name,
        username: user.username,
        role:     user.role,
        employee: user.employee, // null if admin
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get current logged-in user
// @route   GET /api/auth/me
export const getMe = async (req, res) => {
  res.json(req.user);
};

// @desc    Create user account (admin only)
// @route   POST /api/auth/register
export const register = async (req, res) => {
  try {
    const { name, username, password, role, employeeId } = req.body;

    const exists = await User.findOne({ username });
    if (exists) return res.status(400).json({ message: 'Username already taken' });

    const user = await User.create({
      name,
      username,
      password,
      role: role || 'employee',
      employee: employeeId || null,
    });

    res.status(201).json({
      id:       user._id,
      name:     user.name,
      username: user.username,
      role:     user.role,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};