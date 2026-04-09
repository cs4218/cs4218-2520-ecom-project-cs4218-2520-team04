export default {
  displayName: "security",
  testEnvironment: "jest-environment-jsdom",
  transform: {
    "^.+\\.(js|jsx|mjs)$": "babel-jest",
  },
  moduleNameMapper: {
    "^axios$": "<rootDir>/client/node_modules/axios/dist/node/axios.cjs",
    "^react$": "<rootDir>/client/node_modules/react/index.js",
    "^react-dom$": "<rootDir>/client/node_modules/react-dom/index.js",
    "^react-hot-toast$":
      "<rootDir>/client/node_modules/react-hot-toast/dist/index.js",
    "\\.(css|scss)$": "identity-obj-proxy",
  },
  modulePaths: ["<rootDir>/client/node_modules"],
  transformIgnorePatterns: [
    "/node_modules/(?!(styleMock\\.js|mongodb-memory-server|mongodb-memory-server-core|mongodb|bson|mongodb-connection-string-url|whatwg-url)/)",
  ],
  testMatch: ["<rootDir>/tests/security/**/*.test.js"],
  setupFiles: ["<rootDir>/tests/security/setup.js"],
  setupFilesAfterEnv: ["<rootDir>/client/src/setupTests.js"],
};
