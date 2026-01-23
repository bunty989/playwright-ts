import { defineConfig } from '@playwright/test';
import { parseBooleanEnv, parseStringEnv } from './support/envUtils';

const asPositiveNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const asDurationMs = (value: string | undefined, fallbackMs: number): number => {
  const parsed = asPositiveNumber(value, fallbackMs);
  return parsed < 1000 ? parsed * 1000 : parsed;
};

const defaultBrowser = parseStringEnv(process.env.BROWSER) ?? 'chromium';
const defaultHeadless = parseBooleanEnv(parseStringEnv(process.env.HEADLESS), true);
const defaultTimeoutMs = asDurationMs(parseStringEnv(process.env.DEFAULT_TIMEOUT), 60_000);
const retries = asPositiveNumber(parseStringEnv(process.env.RETRY), 3);
const parallel = asPositiveNumber(parseStringEnv(process.env.PARALLEL), 10);
const apiTimeoutMs = asPositiveNumber(parseStringEnv(process.env.API_TIMEOUT_SECONDS), 30) * 1000;

export const frameworkRuntimeSettings = {
  defaultBrowser,
  defaultHeadless,
  defaultTimeoutMs,
  retries,
  parallel,
  apiTimeoutMs,
  videoDir: 'allure-results/videos',
  videoSize: { width: 1280, height: 720 },
};

const playwrightConfig = defineConfig({
  timeout: defaultTimeoutMs,
  retries,
  workers: parallel,
  outputDir: 'allure-results',
  use: {
    headless: defaultHeadless,
    ignoreHTTPSErrors: true,
    viewport: null,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: {
      mode: 'retain-on-failure',
      size: frameworkRuntimeSettings.videoSize,
    },
    launchOptions: {
      args: ['--start-maximized'],
    },
  },
});

export default playwrightConfig;
