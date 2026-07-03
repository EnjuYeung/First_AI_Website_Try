export const isStrongPassword = (value) =>
  typeof value === 'string' &&
  value.length >= 12 &&
  value.length <= 128 &&
  /[a-z]/.test(value) &&
  /[A-Z]/.test(value) &&
  /\d/.test(value) &&
  /[^A-Za-z0-9]/.test(value);

export const assertStrongSecret = (name, value) => {
  if (typeof value !== 'string' || value.length < 32) {
    throw new Error(`${name}_must_be_at_least_32_characters`);
  }
  return value;
};
