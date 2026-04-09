const DEFAULT_CONFIG = {
  maxAttempts: Number(process.env.AUTH_RATE_LIMIT_MAX_ATTEMPTS) || 5,
  windowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 10 * 60 * 1000,
  blockMs: Number(process.env.AUTH_RATE_LIMIT_BLOCK_MS) || 15 * 60 * 1000,
};

const accountFailures = new Map();
const ipFailures = new Map();

let runtimeConfig = { ...DEFAULT_CONFIG };

const pruneState = (state, now) => {
  if (!state) {
    return null;
  }

  const recentAttempts = state.attempts.filter(
    (timestamp) => now - timestamp <= runtimeConfig.windowMs
  );
  const blockedUntil =
    state.blockedUntil && state.blockedUntil > now ? state.blockedUntil : 0;

  if (recentAttempts.length === 0 && !blockedUntil) {
    return null;
  }

  return {
    attempts: recentAttempts,
    blockedUntil,
  };
};

const getScopedState = (store, key, now) => {
  if (!key) {
    return null;
  }

  const nextState = pruneState(store.get(key), now);

  if (!nextState) {
    store.delete(key);
    return null;
  }

  store.set(key, nextState);
  return nextState;
};

const recordScopedFailure = (store, key, now) => {
  if (!key) {
    return null;
  }

  const nextState = getScopedState(store, key, now) || {
    attempts: [],
    blockedUntil: 0,
  };

  nextState.attempts.push(now);

  if (nextState.attempts.length >= runtimeConfig.maxAttempts) {
    nextState.blockedUntil = now + runtimeConfig.blockMs;
  }

  store.set(key, nextState);
  return nextState;
};

const getBlockedScope = (store, key, now, scope) => {
  const state = getScopedState(store, key, now);

  if (state?.blockedUntil && state.blockedUntil > now) {
    return {
      blocked: true,
      scope,
      retryAfterMs: state.blockedUntil - now,
    };
  }

  return null;
};

export const normalizeEmail = (email = "") =>
  typeof email === "string" ? email.trim().toLowerCase() : "";

export const getRequestIp = (req) => {
  return (
    req.socket?.remoteAddress ||
    req.connection?.remoteAddress ||
    "unknown-ip"
  );
};

export const getLoginThrottleState = ({ email, ip, now = Date.now() }) => {
  return (
    getBlockedScope(accountFailures, email, now, "account") ||
    getBlockedScope(ipFailures, ip, now, "ip") || {
      blocked: false,
      retryAfterMs: 0,
    }
  );
};

export const recordFailedLoginAttempt = ({ email, ip, now = Date.now() }) => {
  recordScopedFailure(accountFailures, email, now);
  recordScopedFailure(ipFailures, ip, now);
};

export const clearFailedLoginAttempts = ({ email, ip }) => {
  if (email) {
    accountFailures.delete(email);
  }

  if (ip) {
    ipFailures.delete(ip);
  }
};

export const configureLoginProtectionForTests = (overrides = {}) => {
  runtimeConfig = {
    ...runtimeConfig,
    ...overrides,
  };
};

export const resetLoginProtectionState = () => {
  accountFailures.clear();
  ipFailures.clear();
  runtimeConfig = { ...DEFAULT_CONFIG };
};
