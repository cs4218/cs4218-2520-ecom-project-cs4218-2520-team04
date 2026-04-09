import {
  PASSWORD_POLICY_HINT,
  PASSWORD_POLICY_MESSAGE,
  validatePasswordStrength,
} from "./passwordPolicy.js";

describe("passwordPolicy", () => {
  test("accepts passwords that meet the minimum policy", () => {
    expect(validatePasswordStrength("StrongPass1!")).toEqual({ valid: true });
  });

  test("rejects passwords that are too short or missing required character classes", () => {
    expect(validatePasswordStrength("Short1!")).toEqual({
      valid: false,
      message: PASSWORD_POLICY_MESSAGE,
    });
    expect(validatePasswordStrength("1234567890")).toEqual({
      valid: false,
      message: PASSWORD_POLICY_MESSAGE,
    });
    expect(validatePasswordStrength("passwordonly")).toEqual({
      valid: false,
      message: PASSWORD_POLICY_MESSAGE,
    });
    expect(validatePasswordStrength("lowercase1!")).toEqual({
      valid: false,
      message: PASSWORD_POLICY_MESSAGE,
    });
    expect(validatePasswordStrength("UPPERCASE1!")).toEqual({
      valid: false,
      message: PASSWORD_POLICY_MESSAGE,
    });
  });

  test("exports a user-facing password hint", () => {
    expect(PASSWORD_POLICY_HINT).toBe(
      "Use at least 10 characters with uppercase, lowercase, number, and special characters."
    );
  });
});
