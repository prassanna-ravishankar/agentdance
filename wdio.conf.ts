import type { Options } from '@wdio/types';

export const config: Options.Testrunner = {
  runner: 'local',
  specs: ['./tests/e2e/**/*.spec.ts'],
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: { timeout: 30000 },
  capabilities: [{}],
  hostname: '127.0.0.1',
  port: 4445,
  path: '/',
};
