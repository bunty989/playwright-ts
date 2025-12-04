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

  publishQuiet: false,

  format: [
    'allure-cucumberjs/reporter'
    // ['@cucumber/html-formatter', { output: 'reports/cucumber-report.html' }],
    // 'progress',
    // '@cucumber/pretty-formatter'
  ],

  formatOptions: {
    resultsDir: 'allure-results'
  },

  retry: 3,
  parallel: 10
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
