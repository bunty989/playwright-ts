// framework/support/allureEnvironment.ts
import { BeforeAll } from '@cucumber/cucumber';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getPrimaryDisplayResolution } from './systemInfo';

// Get Playwright version
function getPlaywrightVersion(): string {
  try {
    const pkg = require('@playwright/test/package.json');
    return pkg.version || 'unknown';
  } catch {
    try {
      const pkg = require('playwright/package.json');
      return pkg.version || 'unknown';
    } catch {
      return 'unknown';
    }
  }
}

BeforeAll(async function () {
  const resultsDir = path.resolve(process.cwd(), 'allure-results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const hostName = os.hostname();
  const domain = process.env.USERDOMAIN || ''; // Windows only; on Linux/macos this may be empty
  const userName = os.userInfo().username;
  const osVersion = `${os.type()} ${os.release()} (${os.platform()})`;

  const playwrightVersion = getPlaywrightVersion();
  const browserName = (process.env.BROWSER || 'chromium').toLowerCase();

  const { width, height } = await getPrimaryDisplayResolution();

  const props = new Map<string, string>([
    ['Host Name', hostName],
    ['Domain', domain],
    ['Username', userName],
    ['OS Version', osVersion],
    ['Playwright Version', playwrightVersion],
    ['Browser Name', browserName],
    ['Display Resolution', `${width}x${height}`],
  ]);

  const envFilePath = path.join(resultsDir, 'environment.properties');
  const lines: string[] = [];

  for (const [key, value] of props) {
    lines.push(`${key}=${value}`);
  }

  fs.writeFileSync(envFilePath, lines.join(os.EOL), { encoding: 'utf8' });
});
