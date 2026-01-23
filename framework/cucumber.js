const fs = require('fs');
const path = require('path');

require('ts-node/register');

const { frameworkRuntimeSettings } = require('./playwright.config.ts');

const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const common = {
  requireModule: ['ts-node/register', 'dotenv/config'],

  require: [
    'test/step-definitions/**/*.ts',
    'framework/support/**/*.ts',
    'framework/hooks/**/*.ts',
    'framework/playwrightHelpers/**/*.ts',
    'framework/driverHelpers/**/*.ts'
  ],

  paths: ['test/features/**/*.feature'],

  publishQuiet: true,

  format: [
    'allure-cucumberjs/reporter',
    'html:logs/cucumber-report.html',
    'json:logs/cucumber-report.json'
  ],

  formatOptions: {
    resultsDir: 'allure-results'
  },

  retry: frameworkRuntimeSettings?.retries,
  parallel: frameworkRuntimeSettings?.parallel
};

module.exports = {
  default: common,

  ui: {
    ...common,
    tags: 'not @api and not @ignore'
  },

  api: {
    ...common,
    tags: '@api and not @ignore'
  }
};
