export default {
  displayName: "integration-backend",
  testEnvironment: "node",
  testMatch: [
    "<rootDir>/tests/integration/admin/*.test.js",
    "<rootDir>/tests/integration/auth/*.test.js",
    "<rootDir>/tests/integration/database/*.test.js"
  ],
};