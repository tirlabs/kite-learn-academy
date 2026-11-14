(function (global) {
  "use strict";

  function finiteNumber(value, label, minimum, maximum) {
    const number = Number(value);
    if (!Number.isFinite(number)) throw new Error(`${label} must be a valid number.`);
    if (number < minimum || number > maximum) {
      throw new Error(`${label} must be between ${minimum} and ${maximum}.`);
    }
    return number;
  }

  function validateInputs(schema, values) {
    const clean = {};
    for (const field of schema) {
      clean[field.name] = finiteNumber(
        values[field.name], field.label, field.min, field.max
      );
      if (field.integer && !Number.isInteger(clean[field.name])) {
        throw new Error(`${field.label} must be a whole number.`);
      }
    }
    return clean;
  }

  global.KiteLearnCalculatorCore = Object.freeze({ finiteNumber, validateInputs });
})(window);
