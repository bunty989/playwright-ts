import {
  Before,
  After,
  AfterStep,
  BeforeAll,
  BeforeStep,
  Status,
} from '@cucumber/cucumber';
import { CustomWorld } from '../support/world';
import { DriverManager } from '../driverHelpers/driverManager';
import { getPrimaryDisplayResolution } from '../support/systemInfo';
import { Log } from '../support/logger';
import fs from 'fs';
import path from 'path';
import * as os from 'os';
import {
  getContextOptions,
  getHeadlessSetting,
  getLaunchOptions,
} from '../support/playwrightRuntimeConfig';

const DOTENV_PATH = path.join(process.cwd(), '.env');
let wroteBrowserVersion = false;

type ScreenshotMode = 'success' | 'failure' | 'none' | 'all';

function getScreenshotModeFromEnv(): ScreenshotMode {
  const raw = (process.env.CUCUMBER_SCREENSHOT_MODE || 'failure').toLowerCase().trim();
  if (raw === 'success' || raw === 'failure' || raw === 'none' || raw === 'all') {
    return raw;
  }
  return 'failure';
}

function shouldAttachScenarioScreenshot(mode: ScreenshotMode, status: string | undefined): boolean {
  if (mode === 'none' || !status) return false;
  if (mode === 'all') return false;
  if (mode === 'success') return status === Status.PASSED;
  return status === Status.FAILED;
}

function shouldAttachStepScreenshot(mode: ScreenshotMode): boolean {
  return mode === 'all';
}

function shouldAttachVideo(): boolean {
  return (process.env.ATTACH_VIDEO_TO_REPORTS || 'false').toLowerCase().trim() === 'true';
}

async function updateDotEnvKey(key: string, value: string) {
  const text = fs.existsSync(DOTENV_PATH)
    ? fs.readFileSync(DOTENV_PATH, 'utf8')
    : '';
  const lines = text.split(/\r?\n/).filter(Boolean);
  const others = lines.filter(l => !l.startsWith(`${key}=`));
  others.push(`${key}=${value}`);
  fs.writeFileSync(DOTENV_PATH, others.join(os.EOL), 'utf8');
  process.env[key] = value;
}

async function detectBrowserVersionFromWorld(world: any): Promise<string> {
  try {
    if (world?.browser && typeof world.browser.version === 'function') {
      const ver = await world.browser.version();
      if (ver) return String(ver);
    }

    if (world?.page) {
      try {
        const ua: string = await world.page.evaluate(() => navigator.userAgent);
        if (ua) {
          let m = ua.match(
            /(?:Chrome|Chromium|CriOS|Edg|OPR)\/([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+|[0-9]+\.[0-9]+\.[0-9]+|[0-9]+\.[0-9]+)/
          );
          if (m && m[1]) return m[1];
          m = ua.match(/Firefox\/([0-9]+\.[0-9]+(?:\.[0-9]+)?)/);
          if (m && m[1]) return m[1];
          m = ua.match(/Version\/([0-9]+\.[0-9]+(?:\.[0-9]+)?).*Safari/);
          if (m && m[1]) return m[1];
          m = ua.match(/([0-9]+\.[0-9]+\.[0-9]+)/);
          if (m && m[1]) return m[1];
        }
      } catch {
        // best-effort parsing
      }
    }
  } catch (err) {
    Log.warn('Error while detecting browser version from world', { err: String(err) });
  }
  return 'unknown';
}

BeforeAll(function () {
  Log.info('========== Test Run Started ==========');
});

Before(async function (this: CustomWorld, scenario: any) {
  const scenarioName = scenario.pickle?.name;
  const tags: string[] = (scenario?.pickle?.tags || []).map((t: any) => t.name as string);
  Log.info('Starting scenario', {
    name: scenarioName,
    tags,
  });
  this.isApiTest = tags.includes('@api');

  if (this.isApiTest) {
    Log.info('API scenario detected — browser will not be launched.');
    return;
  }

  const browserName = DriverManager.resolveBrowserFromEnv();
  this.browserName = browserName;
  Log.info('Launching browser', { browserName });

  const headless = getHeadlessSetting();
  const { width, height } = await getPrimaryDisplayResolution();
  Log.info('Detected display resolution', { width, height });

  const launchOptions = getLaunchOptions(browserName);
  Log.debug('Browser launch options', launchOptions);
  await this.driverManager.openBrowser(browserName, launchOptions);

  const contextOptions = getContextOptions(browserName, width, height);
  Log.debug('Creating browser context', { ...contextOptions, headless });
  await this.driverManager.newContext(contextOptions);

  this.browser = this.driverManager.browser;
  this.context = this.driverManager.context;
  this.page = this.driverManager.page;
  Log.info('Browser and context set up successfully');

  if (tags.includes('@ui') && !wroteBrowserVersion) {
    try {
      const browserVersion = await detectBrowserVersionFromWorld(this);
      await updateDotEnvKey('BROWSER_VERSION', browserVersion);
      Log.info('Detected and wrote BROWSER_VERSION to .env', { browserVersion });
      wroteBrowserVersion = true;
    } catch (err) {
      Log.warn('Failed to detect/write BROWSER_VERSION', { err: String(err) });
    }
  }
});

BeforeStep(function (this: CustomWorld, { pickleStep }) {
  Log.debug('Starting step', {
    step: pickleStep?.text,
  });
});

After(async function (this: CustomWorld, scenario: any) {
  const scenarioName = scenario?.pickle?.name;
  const status = scenario?.result?.status;

  Log.info('Finished scenario', {
    name: scenarioName,
    status,
  });
  if (this.isApiTest) {
    Log.info('API scenario — no browser cleanup required.');
    return;
  }

  try {
    if (this.page && shouldAttachScenarioScreenshot(getScreenshotModeFromEnv(), status)) {
      const screenshotBuffer = await this.page.screenshot({
        type: 'jpeg',
        quality: 55,
      });
      await this.attach(screenshotBuffer, 'image/jpeg');
    }
  } catch {
    // Do not fail test if screenshot attachment fails
  }

  try {
    if (shouldAttachVideo() && this.page) {
      const video = this.page.video();
      if (video) {
        const videoPath = await video.path();

        if (fs.existsSync(videoPath)) {
          const videoBuffer = fs.readFileSync(videoPath);
          await this.attach(videoBuffer, 'video/webm');
        }
      }
    }
  } catch {
    // Do not fail test if video attachment fails
  }

  await this.driverManager.closeContext();
  await this.driverManager.closeBrowser();
  Log.info('Browser and context closed successfully.');
  this.page = undefined;
  this.context = undefined;
  this.browser = undefined;
});

AfterStep(async function (this: CustomWorld, { pickleStep, result }: any) {
  const stepText = pickleStep?.text;
  Log.debug('Finished step', {
    step: stepText,
    status: result?.status,
  });
  if (this.isApiTest) {
    if (pickleStep?.text === 'I should get a response for the api call') {
      if (this.apiResponseBody) {
        const trimmed = this.apiResponseBody.trim();
        const looksJson = trimmed.startsWith('{') || trimmed.startsWith('[');

        await this.attach(
          this.apiResponseBody,
          looksJson ? 'application/json' : 'text/plain'
        );
      }

      if (this.fullRequestUrl) {
        await this.attach(`Request URL:\n${this.fullRequestUrl}`, 'text/plain');
      }

      if (this.requestQueryParams) {
        await this.attach(
          JSON.stringify(this.requestQueryParams, null, 2),
          'application/json'
        );
      }

      if (this.responseTimeMs !== undefined) {
        await this.attach(`Response Time: ${this.responseTimeMs} ms`, 'text/plain');
      }
    }

    return;
  }

  const screenshotMode = getScreenshotModeFromEnv();
  if (!shouldAttachStepScreenshot(screenshotMode) || !this.page) {
    return;
  }

  try {
    const screenshotBuffer = await this.page.screenshot({
      type: 'jpeg',
      quality: 40,
    });
    await this.attach(screenshotBuffer, 'image/jpeg');
  } catch {
    // Do not fail test if screenshot attachment fails
  }
});


