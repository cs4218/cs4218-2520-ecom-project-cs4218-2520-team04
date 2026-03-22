export default {
  projects: [
    "<rootDir>/jest.backend.config.js",
    "<rootDir>/jest.frontend.config.js",
    "<rootDir>/jest.integration.backend.config.js",
    "<rootDir>/jest.integration.frontend.config.js",
  ],
  collectCoverageFrom: [
    "controllers/**/*.js",
    "models/**/*.js",
    "helpers/**/*.js",
    "middlewares/**/*.js",
    "config/**/*.js",
    "routes/**/*.js",
    "client/src/**/*.js",
    "!**/*.test.js",
    "!**/*.integration.test.js",
    "!client/src/setupTests.js",
  ],
  coverageDirectory: "<rootDir>/coverage",
  coverageReporters: ["lcov", "json", "text-summary"],
};
