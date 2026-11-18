(function (global) {
  "use strict";

  const schema = [
    { name: "monthlyInvestment", label: "Monthly investment", min: 1, max: 100000000 },
    { name: "annualReturn", label: "Assumed annual return", min: 0, max: 100 },
    { name: "years", label: "Investment duration", min: 1, max: 50, integer: true }
  ];

  function calculate(values) {
    const clean = global.KiteLearnCalculatorCore.validateInputs(schema, values);
    const months = clean.years * 12;
    const monthlyRate = clean.annualReturn / 100 / 12;
    const invested = clean.monthlyInvestment * months;

    // Ordinary annuity: each SIP instalment is assumed to be invested at month-end.
    const futureValue = monthlyRate === 0
      ? invested
      : clean.monthlyInvestment * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);

    return Object.freeze({
      monthlyInvestment: clean.monthlyInvestment,
      annualReturn: clean.annualReturn,
      years: clean.years,
      months,
      invested,
      estimatedValue: futureValue,
      estimatedGrowth: futureValue - invested,
      monthlyRate
    });
  }

  global.KiteLearnSIPCalculator = Object.freeze({ schema, calculate });
})(window);
