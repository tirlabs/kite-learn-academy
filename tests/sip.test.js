const assert = require("node:assert/strict");
global.window = global;
require("../js/calculators/calculator-core.js");
require("../js/calculators/modules/sip.js");

const calculate = global.KiteLearnSIPCalculator.calculate;
const example = calculate({ monthlyInvestment: 5000, annualReturn: 12, years: 10 });
assert.equal(example.months, 120);
assert.equal(example.invested, 600000);
assert.ok(Math.abs(example.estimatedValue - 1150193.4473) < 0.02);
assert.ok(Math.abs(example.estimatedGrowth - 550193.4473) < 0.02);

const zeroReturn = calculate({ monthlyInvestment: 5000, annualReturn: 0, years: 10 });
assert.equal(zeroReturn.estimatedValue, 600000);
assert.equal(zeroReturn.estimatedGrowth, 0);

assert.throws(() => calculate({ monthlyInvestment: -1, annualReturn: 12, years: 10 }), /between/);
assert.throws(() => calculate({ monthlyInvestment: 5000, annualReturn: 12, years: 0 }), /between/);
assert.throws(() => calculate({ monthlyInvestment: 5000, annualReturn: 12, years: 1.5 }), /whole number/);
assert.throws(() => calculate({ monthlyInvestment: 5000, annualReturn: 101, years: 10 }), /between/);

console.log("SIP calculator tests passed: standard case, zero return, and input validation.");
