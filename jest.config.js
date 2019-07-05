const config = {
  preset: 'ts-jest',
  moduleDirectories: ['node_modules', 'src'],
  testEnvironment: 'node',
  globals: {
    'ts-jest': {
      diagnostics: {
        ignoreCodes: [
          // allow for unused variables in test files
          6133,
          // allow for unused types in test files
          6196
        ]
      }
    }
  }
};

const unitTests = Object.assign(
  {
    displayName: 'Unit Tests',
    testRegex: '.*\\.spec\\.ts$'
  },
  config
);

const e2eTests = Object.assign(
  {
    displayName: 'E2E Tests',
    testRegex: '.*\\.e2e\\.ts$',
    globalSetup: '<rootDir>/src/tests/setupTests.js'
  },
  config
);

module.exports = {
  projects: [unitTests, e2eTests]
};
