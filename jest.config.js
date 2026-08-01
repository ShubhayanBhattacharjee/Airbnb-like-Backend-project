export default {
  testEnvironment: "node",
  transform: {},
  testMatch: [
    "**/tests/unit/**/*.test.js",
    "**/tests/integration/**/*.test.js",
  ],
  testTimeout: 20000, // integration tests spin up mongodb-memory-server, give them room
};