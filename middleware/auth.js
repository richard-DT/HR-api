import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// Checks if the user is logged in (valid token)
export const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Not authorized, no token' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach user to request (excluding password)
    req.user = await User.findById(decoded.id).select('-password');

    if (!req.user || !req.user.isActive) {
      return res.status(401).json({ message: 'User not found or deactivated' });
    }

    next();
  } catch (error) {
    res.status(401).json({ message: 'Not authorized, invalid token' });
  }
};

// Allows admin only
export const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied. Admins only.' });
  }
  next();
};

// Allows employee to access only their own data
export const selfOrAdmin = (req, res, next) => {
  const isAdmin = req.user?.role === 'admin';
  const isSelf  = req.user?.employee?.toString() === req.params.employeeId;

  if (!isAdmin && !isSelf) {
    return res.status(403).json({ message: 'Access denied. You can only view your own records.' });
  }
  next();
};