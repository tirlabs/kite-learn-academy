(function (global) {
  "use strict";

  const currencyFormatter = new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0
  });
  const numberFormatter = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

  global.KiteLearnCalculatorFormat = Object.freeze({
    currency(value) {
      if (!Number.isFinite(value)) return "—";
      return currencyFormatter.format(value);
    },
    number(value, digits = 2) {
      if (!Number.isFinite(value)) return "—";
      return new Intl.NumberFormat("en-IN", { maximumFractionDigits: digits }).format(value);
    },
    percent(value, digits = 2) {
      if (!Number.isFinite(value)) return "—";
      return `${numberFormatter.format(Number(value.toFixed(digits)))}%`;
    }
  });
})(window);
