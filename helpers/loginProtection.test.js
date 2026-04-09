import {
  clearFailedLoginAttempts,
  configureLoginProtectionForTests,
  getLoginThrottleState,
  getRequestIp,
  normalizeEmail,
  recordFailedLoginAttempt,
  resetLoginProtectionState,
} from "./loginProtection.js";

describe("loginProtection", () => {
  beforeEach(() => {
    resetLoginProtectionState();
    configureLoginProtectionForTests({
      maxAttempts: 2,
      windowMs: 1000,
      blockMs: 5000,
    });
  });

  afterEach(() => {
    resetLoginProtectionState();
  });

  test("normalizes emails and extracts the client IP", () => {
    expect(normalizeEmail("  User@Example.COM ")).toBe("user@example.com");
    expect(
      getRequestIp({
        socket: { remoteAddress: "203.0.113.5" },
      })
    ).toBe("203.0.113.5");
  });

  test("blocks after repeated failures and can be cleared", () => {
    const identity = {
      email: "user@example.com",
      ip: "203.0.113.5",
      now: 100,
    };

    recordFailedLoginAttempt(identity);
    expect(
      getLoginThrottleState({
        email: identity.email,
        ip: identity.ip,
        now: 101,
      }).blocked
    ).toBe(false);

    recordFailedLoginAttempt({
      ...identity,
      now: 200,
    });

    expect(
      getLoginThrottleState({
        email: identity.email,
        ip: identity.ip,
        now: 201,
      })
    ).toEqual(
      expect.objectContaining({
        blocked: true,
        retryAfterMs: expect.any(Number),
      })
    );

    clearFailedLoginAttempts({
      email: identity.email,
      ip: identity.ip,
    });

    expect(
      getLoginThrottleState({
        email: identity.email,
        ip: identity.ip,
        now: 202,
      })
    ).toEqual({
      blocked: false,
      retryAfterMs: 0,
    });
  });
});
