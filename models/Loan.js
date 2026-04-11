import mongoose from 'mongoose';

// Each monthly payment entry
const paymentSchema = new mongoose.Schema({
  month:         { type: Date, required: true },   // which month yung bayad
  amountPaid:    { type: Number, required: true },
}, { _id: false });

const loanSchema = new mongoose.Schema({
  employee:      { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  dateTaken:     { type: Date, required: true },
  principalAmount: { type: Number, required: true },  // original loan amount
  monthlyPayment:  { type: Number, required: true },  // fixed monthly deduction
  balance:         { type: Number, required: true },  // remaining balance
  payments:        [paymentSchema],                   // history of monthly payments
  isSettled:       { type: Boolean, default: false },
}, { timestamps: true });

export default mongoose.model('Loan', loanSchema);