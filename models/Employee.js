import mongoose from 'mongoose';

const salaryHistorySchema = new mongoose.Schema({
  effectiveDate: { type: Date, required: true },
  monthlyRate:   { type: Number, required: true },
  isCurrent:     { type: Boolean, default: false },
}, { _id: false });

const employeeSchema = new mongoose.Schema({
  name:          { type: String, required: true, trim: true },
  hireDate:      { type: Date, required: true },
  position:      { type: String, default: '' },
  isActive:      { type: Boolean, default: true },
  monthlyRate:   { type: Number, required: true },
  variableBonus: { type: Number, default: 0 },
  salaryHistory: [salaryHistorySchema],
}, { timestamps: true });

export default mongoose.model('Employee', employeeSchema);