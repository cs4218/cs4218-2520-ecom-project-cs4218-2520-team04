export const PASSWORD_POLICY = {
  minLength: 10,
};

export const PASSWORD_POLICY_MESSAGE =
  "Password must be at least 10 characters long and include uppercase, lowercase, number, and special characters.";

export const PASSWORD_POLICY_HINT =
  "Use at least 10 characters with uppercase, lowercase, number, and special characters.";

export const validatePasswordStrength = (password) => {
  if (typeof password !== "string") {
    return {
      valid: false,
      message: PASSWORD_POLICY_MESSAGE,
    };
  }

  const hasMinimumLength = password.length >= PASSWORD_POLICY.minLength;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecialCharacter = /[^A-Za-z0-9]/.test(password);

  if (
    !hasMinimumLength ||
    !hasUppercase ||
    !hasLowercase ||
    !hasNumber ||
    !hasSpecialCharacter
  ) {
    return {
      valid: false,
      message: PASSWORD_POLICY_MESSAGE,
    };
  }

  return { valid: true };
};
