import mongoose from 'mongoose';

// Each day entry inside a weekly payslip
const dayEntrySchema = new mongoose.Schema({
  weekday:    { type: String },               // "Tue", "Wed", etc.
  dayNumber:  { type: Number },               // actual calendar day
  actualDate:  { type: Date }, 
  attendance: { type: String, enum: [
    'present',      // present
    'ot',     // overtime
    'partial',
    'rest',   // rest day
    'sl',     // sick leave
    'vl',     // vacation leave
    'absent', // absent
    'holiday' // holiday
  ]},
  hoursWorked: { type: Number, default: 8 },
  otHours:     { type: Number, default: 0 },
  dailyPay:    { type: Number, default: 0 },
  overtime:    { type: Number, default: 0 },
  advances:    { type: Number, default: 0 },
  remarks:     { type: String, default: '' },
}, { _id: false });

const attendanceWeekSchema = new mongoose.Schema({
  employee:        { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  periodStart:     { type: Date, required: true },  // e.g. Nov 1, 2022
  periodEnd:       { type: Date, required: true },  // e.g. Nov 7, 2022
  days:            [dayEntrySchema],                // 7 day entries
  totalDailyPay:   { type: Number, default: 0 },
  totalOvertime:   { type: Number, default: 0 },
  totalAdvances:   { type: Number, default: 0 },
  netPay:          { type: Number, default: 0 },    // computed: dailyPay + OT - advances
  isPublished:     { type: Boolean, default: false }
}, { timestamps: true });

export default mongoose.model('AttendanceWeek', attendanceWeekSchema);