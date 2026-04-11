// Compute OT pay
export const computeOTPay = (dailyRate, otHours = 4) => {
  return (dailyRate / 8) * 1.25 * otHours;
};

// Compute daily pay based on attendance type
export const computeDailyPay = (attendance, dailyRate) => {
  switch (attendance) {
    case 'p':
    case 'ot':       // pumasok ng normal hours + OT
      return dailyRate;
    case 'rest':
    case 'absent':
    case 'sl':
    case 'vl':
    case 'holiday':
      return 0;
    default:
      return 0;
  }
};

// Compute weekly totals from days array
export const computeWeeklyTotals = (days) => {
  const totalDailyPay = days.reduce((sum, d) => sum + (d.dailyPay || 0), 0);
  const totalOvertime = days.reduce((sum, d) => sum + (d.overtime || 0), 0);
  const totalAdvances = days.reduce((sum, d) => sum + (d.advances || 0), 0);
  const netPay        = totalDailyPay + totalOvertime - totalAdvances;

  return { totalDailyPay, totalOvertime, totalAdvances, netPay };
};

// FIFO loan deduction — deducts advances from loans oldest first
export const applyLoanDeductions = async (loans, totalAdvances) => {
  let remaining = totalAdvances;
  const updatedLoans = [];

  for (const loan of loans) {
    if (remaining <= 0) break;
    if (loan.isSettled) continue;

    if (remaining >= loan.balance) {
      // This loan gets fully settled
      remaining      = remaining - loan.balance;
      loan.balance   = 0;
      loan.isSettled = true;
    } else {
      // Partial payment
      loan.balance = loan.balance - remaining;
      remaining    = 0;
    }

    updatedLoans.push(loan);
  }

  // Save all updated loans
  for (const loan of updatedLoans) {
    await loan.save();
  }

  return updatedLoans;
};