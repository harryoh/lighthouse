export default {
  displayName: 'crawler-core',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/libs/crawler-core',
  testPathIgnorePatterns: [
    '/node_modules/',
    'src/queue/monitoring/QueueMonitor.spec.ts'
  ],
};
