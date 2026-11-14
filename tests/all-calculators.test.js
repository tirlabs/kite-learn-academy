const assert=require("assert");global.window=global;require("../js/calculators/calculator-format.js");const e=require("../js/calculators/calculator-engine.js");
const cases={lumpsum:{principal:100000,annualRate:12,years:10},cagr:{startValue:100000,endValue:200000,years:5},"compound-interest":{principal:100000,annualRate:8,years:10,frequency:4},xirr:{cashflows:"2024-01-01,-100000\n2024-12-31,110000"},swp:{corpus:1000000,monthlyWithdrawal:10000,annualRate:8,years:10},inflation:{currentCost:10000,inflationRate:6,years:10},fd:{principal:100000,annualRate:7,years:3,frequency:4},rd:{monthlyDeposit:5000,annualRate:6.5,years:5},ppf:{annualDeposit:150000,annualRate:7.1,years:15},retirement:{currentAge:35,retirementAge:60,monthlyExpense:50000,inflationRate:6,postReturn:7,retirementYears:25},emi:{principal:2500000,annualRate:9,months:240},brokerage:{buyPrice:100,sellPrice:110,quantity:100,brokeragePerSide:20,otherCharges:10},"stock-average":{quantity1:10,price1:250,quantity2:10,price2:230},dividend:{shares:100,dividendPerShare:5,marketPrice:250},"stock-returns":{buyPrice:100,sellPrice:125,quantity:100,buyCharges:20,sellCharges:20,dividends:0},"risk-reward":{entry:100,stop:95,target:115,quantity:100},"position-sizing":{capital:100000,riskPercent:1,entry:250,stop:240}};
for(const [id,v] of Object.entries(cases)){const r=e.calculate(id,v);assert(Number.isFinite(r.primary),id+" primary result should be finite");}
assert(Math.abs(e.calculate("cagr",cases.cagr).primary-14.8698355)<.001);
assert(Math.abs(e.calculate("xirr",cases.xirr).primary-10)<.01);
assert(Math.abs(e.calculate("emi",cases.emi).primary-22493.15)<1);
assert.throws(()=>e.calculate("compound-interest",{...cases["compound-interest"],frequency:4.5}));
assert.throws(()=>e.calculate("risk-reward",{entry:100,stop:105,target:110,quantity:10}));
assert.throws(()=>e.calculate("xirr",{cashflows:"bad"}));
assert.throws(()=>e.calculate("emi",{principal:-1,annualRate:9,months:12}));

// Numerical and model-convention regression checks.
const xirr=e.calculate("xirr",{cashflows:"2024-01-01,-100000\n2024-12-31,110000"});
assert.strictEqual(xirr.cashflowCount,2);
assert.strictEqual(xirr.invested,100000);
assert.strictEqual(xirr.growth,110000);
assert.match(xirr.secondary,/2024-01-01.*2024-12-31/);
const swp=e.calculate("swp",{corpus:100000,monthlyWithdrawal:10000,annualRate:0,years:2});
assert.strictEqual(swp.totalWithdrawn,100000);
assert.strictEqual(swp.monthsPaid,10);
assert.strictEqual(swp.primary,0);
const zeroRate=e.calculate("emi",{principal:120000,annualRate:0,months:12});
assert.strictEqual(zeroRate.primary,10000);
assert.throws(()=>e.calculate("emi",{principal:120000,annualRate:9,months:12.5}));
const ppf=e.calculate("ppf",{annualDeposit:100000,annualRate:0,years:15});
assert.strictEqual(ppf.primary,1500000);
assert.strictEqual(ppf.invested,1500000);

console.log("All 17 additional calculator modules passed calculation, validation and regression tests.");
