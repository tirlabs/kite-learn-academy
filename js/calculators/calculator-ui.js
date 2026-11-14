(function (global) {
  "use strict";

  const core = global.KiteLearnCalculatorCore;
  const format = global.KiteLearnCalculatorFormat;
  const sip = global.KiteLearnSIPCalculator;

  function initSIP() {
    const form = document.querySelector("#sip-form");
    if (!form) return;

    const fields = {
      monthlyInvestment: form.elements.monthlyInvestment,
      annualReturn: form.elements.annualReturn,
      years: form.elements.years
    };
    const error = document.querySelector("#sip-error");
    const output = document.querySelector("#sip-results");
    const investedNode = document.querySelector("#sip-invested");
    const growthNode = document.querySelector("#sip-growth");
    const totalNode = document.querySelector("#sip-total");
    const chartInvested = document.querySelector("#sip-bar-invested");
    const chartGrowth = document.querySelector("#sip-bar-growth");
    const chartLegendInvested = document.querySelector("#sip-legend-invested");
    const chartLegendGrowth = document.querySelector("#sip-legend-growth");
    const summary = document.querySelector("#sip-summary");

    function update() {
      try {
        const result = sip.calculate({
          monthlyInvestment: fields.monthlyInvestment.value,
          annualReturn: fields.annualReturn.value,
          years: fields.years.value
        });
        error.hidden = true;
        error.textContent = "";
        output.hidden = false;
        investedNode.textContent = format.currency(result.invested);
        growthNode.textContent = format.currency(result.estimatedGrowth);
        totalNode.textContent = format.currency(result.estimatedValue);
        chartLegendInvested.textContent = format.currency(result.invested);
        chartLegendGrowth.textContent = format.currency(result.estimatedGrowth);
        const safeTotal = Math.max(result.estimatedValue, 0.000001);
        const investedPercent = Math.max(0, Math.min(100, result.invested / safeTotal * 100));
        chartInvested.style.width = `${investedPercent}%`;
        chartGrowth.style.width = `${100 - investedPercent}%`;
        summary.textContent = `Investing ${format.currency(result.monthlyInvestment)} at the end of each month for ${result.years} years, using an assumed annual return of ${format.percent(result.annualReturn)}, gives an illustrative future value of ${format.currency(result.estimatedValue)}.`;
      } catch (exception) {
        output.hidden = true;
        error.textContent = exception.message || "Please check your inputs and try again.";
        error.hidden = false;
      }
    }

    form.addEventListener("input", update);
    form.addEventListener("submit", event => event.preventDefault());
    form.addEventListener("reset", () => requestAnimationFrame(update));
    update();
  }

  document.addEventListener("DOMContentLoaded", initSIP);
})(window);
