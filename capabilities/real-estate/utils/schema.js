"use strict";

function assertObject(value, fieldName) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${fieldName} must be an object`);
  }
}

function assertRequiredString(value, fieldName) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} must be a non-empty string`);
  }
}

module.exports = {
  assertObject,
  assertRequiredString,
};
