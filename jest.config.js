/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  moduleNameMapper: {
    "^~/(.*)$": "<rootDir>/src/$1",
    "^franc-min$": "<rootDir>/__mocks__/franc-min.js",
    "^@plasmohq/storage$": "<rootDir>/__mocks__/@plasmohq/storage.js",
  },
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: "tsconfig.json" }],
    "^.+\\.m?js$": "babel-jest",
  },
  transformIgnorePatterns: [
    "node_modules/(?!(@exodus/bytes)/)",
  ],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  testMatch: [
    "**/*.test.ts",
    "**/*.test.tsx",
  ],
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/types/**",
  ],
};
