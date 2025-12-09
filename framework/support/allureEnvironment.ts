// framework/support/allureEnvironment.ts
import { BeforeAll, AfterAll } from '@cucumber/cucumber';
import * as fs from 'fs';
import fss from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { getPrimaryDisplayResolution } from './systemInfo';
import 'dotenv/config';

const ALLURE_DIR = path.join(process.cwd(), 'allure-results');
const ALLURE_FILE = path.join(ALLURE_DIR, 'environment.properties');

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

async function readProperties(filePath: string): Promise<Record<string, string>> {
  try {
    const text = await fss.readFile(filePath, 'utf8');
    const lines = text.split(/\r?\n/);
    const map: Record<string, string> = {};
    for (const line of lines) {
      if (!line || line.trim().startsWith('#')) continue;
      const idx = line.indexOf('=');
      if (idx === -1) continue;
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim();
      map[key] = val;
    }
    return map;
  } catch (err: any) {
    if (err?.code === 'ENOENT') return {}; 
    throw err;
  }
}

async function writePropertiesAtomic(filePath: string, props: Record<string, string>) {
  await fss.mkdir(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.tmp`;
  const lines = Object.entries(props).map(([k, v]) => `${k}=${v}`);
  await fss.writeFile(tmp, lines.join('\n') + '\n', 'utf8');
  await fss.rename(tmp, filePath);
}

BeforeAll(async function () {
  const resultsDir = ALLURE_DIR;
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const hostName = os.hostname();
  const domain = process.env.USERDOMAIN || '';
  const userName = os.userInfo().username;
  const osVersion = `${os.type()} ${os.release()} (${os.platform()})`;

  const playwrightVersion = getPlaywrightVersion();
  const browserName = (process.env.BROWSER || 'chromium').toLowerCase();
  const headless = process.env.HEADLESS || 'true';
  const { width, height } = await getPrimaryDisplayResolution();

  const props = new Map<string, string>([
    ['Host Name', hostName],
    ['Domain', domain],
    ['Username', userName],
    ['OS Version', osVersion],
    ['Playwright Version', playwrightVersion],
    ['Browser Name', browserName],
    ['Headless', headless],
    ['Display Resolution', `${width}x${height}`],
  ]);

  const envFilePath = ALLURE_FILE;
  const lines: string[] = [];

  for (const [key, value] of props) {
    lines.push(`${key}=${value}`);
  }

  fs.writeFileSync(envFilePath, lines.join(os.EOL), { encoding: 'utf8' });
});

AfterAll(async function () {
  try {
    const browserVersion = process.env.BROWSER_VERSION || 'unknown';

    const props = await readProperties(ALLURE_FILE);

    props[`BrowserVersion${process.pid}`] = browserVersion;

    await writePropertiesAtomic(ALLURE_FILE, props);

    console.log(`Allure environment updated: Browser Version=${browserVersion}`);
  } catch (err) {
    console.error('Failed to update allure environment.properties with Browser Version:', err);
  }
});