export default {
  displayName: "integration-frontend",
  testEnvironment: "jest-environment-jsdom",
  transform: {
    "^.+\\.jsx?$": "babel-jest",
  },
  moduleNameMapper: {
    "^axios$": "<rootDir>/client/node_modules/axios/dist/node/axios.cjs",
    "^react$": "<rootDir>/client/node_modules/react/index.js",
    "^react-dom$": "<rootDir>/client/node_modules/react-dom/index.js",
    "^react-hot-toast$": "<rootDir>/client/node_modules/react-hot-toast/dist/index.js",
    "\\.(css|scss)$": "identity-obj-proxy",
  },
  modulePaths: ["<rootDir>/client/node_modules"],
  transformIgnorePatterns: ["/node_modules/(?!(styleMock\\.js)$)"],
  testMatch: [
    "<rootDir>/tests/integration/frontend/**/*.integration.test.js",
    "<rootDir>/client/src/pages/admin/*.integration.test.js",
    "<rootDir>/client/src/components/*.integration.test.js",
    "<rootDir>/client/src/pages/*.integration.test.js"
  ],
  setupFilesAfterEnv: ["<rootDir>/client/src/setupTests.js"],
};
