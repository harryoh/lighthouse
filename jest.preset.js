const nxPreset = require('@nx/jest/preset').default;

module.exports = {
  ...nxPreset,
  // Global Jest configuration to prevent hanging
  testTimeout: 10000,
  detectOpenHandles: true,
  // Use CLI flag instead of config option for forceExit
};
