import mongoose from 'mongoose';

const salaryHistorySchema = new mongoose.Schema({
  effectiveDate: { type: Date, required: true },
  monthlyRate:   { type: Number, required: true },
  dailyRate:     { type: Number, required: true },
  otRate4hrs:    { type: Number, required: true }, // 4hrs OT rate
  isCurrent:     { type: Boolean, default: false },
}, { _id: false });

const employeeSchema = new mongoose.Schema({
  name:              { type: String, required: true, trim: true },
  hireDate:          { type: Date, required: true },
  position:          { type: String, default: '' },
  isActive:          { type: Boolean, default: true },

  // Current rates (denormalized for quick access)
  monthlyRate:       { type: Number, required: true },
  dailyRate:         { type: Number, required: true },
  otRate4hrs:        { type: Number, required: true },
  monthlyRestdayPay: { type: Number, default: 0 },
  variableBonus:     { type: Number, default: 0 },

  // Full salary history (like your Excel top section)
  salaryHistory: [salaryHistorySchema],

}, { timestamps: true });

export default mongoose.model('Employee', employeeSchema);