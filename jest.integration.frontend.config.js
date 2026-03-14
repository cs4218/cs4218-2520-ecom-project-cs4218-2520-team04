export default {
  displayName: "integration-frontend",
  testEnvironment: "jest-environment-jsdom",
  transform: {
    "^.+\\.jsx?$": "babel-jest",
  },
  moduleNameMapper: {
    "\\.(css|scss)$": "identity-obj-proxy",
  },
  transformIgnorePatterns: ["/node_modules/(?!(styleMock\\.js)$)"],
  testMatch: [
    "<rootDir>/client/src/pages/admin/*.integration.test.js",
  ],
  collectCoverage: false,
  setupFilesAfterEnv: ["<rootDir>/client/src/setupTests.js"],
};