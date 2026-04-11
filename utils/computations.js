// Base computations from monthlyRate
export const computeRates = (monthlyRate) => {
  const dailyRate         = monthlyRate / 26;
  const hourlyRate        = dailyRate / 8;
  const monthlyRestdayPay = dailyRate * 4;
  const grossMonthlyPay   = monthlyRate + monthlyRestdayPay;
  const otRate4hrs        = hourlyRate * 1.25 * 4;

  return { dailyRate, hourlyRate, monthlyRestdayPay, grossMonthlyPay, otRate4hrs };
};

// Compute daily pay based on attendance
export const computeDailyPay = (attendance, hourlyRate, hoursWorked = 8) => {
  switch (attendance) {
    case 'present': return hourlyRate * hoursWorked;
    case 'partial': return hourlyRate * hoursWorked;
    case 'ot':      return hourlyRate * hoursWorked;
    case 'absent':
    case 'rest':
    case 'sl':
    case 'vl':
    case 'holiday': return 0;
    default:        return 0;
  }
};

// Compute OT pay
export const computeOTPay = (hourlyRate, otHours = 0) => {
  return hourlyRate * 1.25 * otHours;
};

// Compute weekly totals from days array
export const computeWeeklyTotals = (days) => {
  const totalDailyPay = days.reduce((sum, d) => sum + (d.dailyPay || 0), 0);
  const totalOvertime = days.reduce((sum, d) => sum + (d.overtime || 0), 0);
  const totalAdvances = days.reduce((sum, d) => sum + (d.advances || 0), 0);
  const netPay        = totalDailyPay + totalOvertime - totalAdvances;

  return { totalDailyPay, totalOvertime, totalAdvances, netPay };
};

// FIFO loan deduction
export const applyLoanDeductions = async (loans, totalAdvances) => {
  let remaining = totalAdvances;
  const updatedLoans = [];

  for (const loan of loans) {
    if (remaining <= 0) break;
    if (loan.isSettled) continue;

    if (remaining >= loan.balance) {
      remaining      = remaining - loan.balance;
      loan.balance   = 0;
      loan.isSettled = true;
    } else {
      loan.balance = loan.balance - remaining;
      remaining    = 0;
    }

    updatedLoans.push(loan);
  }

  for (const loan of updatedLoans) {
    await loan.save();
  }

  return updatedLoans;
};