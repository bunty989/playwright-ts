import {
  Browser,
  BrowserContext,
  Page,
  chromium,
  firefox,
  webkit,
  LaunchOptions,
  BrowserContextOptions,
} from '@playwright/test';
import { Log } from '../support/logger';
import { parseStringEnv } from '../support/envUtils';

export type SupportedBrowser = 'chromium' | 'firefox' | 'webkit' | 'edge';

export class DriverManager {
  browser?: Browser;
  context?: BrowserContext;
  page?: Page;

  static resolveBrowserFromEnv(): SupportedBrowser {
    const raw = parseStringEnv(process.env.BROWSER) ?? '';
    const lower = raw.toLowerCase();
    // const browser = (process.env.BROWSER || 'chromium').toLowerCase();

    switch (lower) {
      case 'firefox':
        Log.debug('Resolved browser from env', { requested: raw, resolved: 'firefox' });
        return 'firefox';
      case 'webkit':
      case 'safari':
        Log.debug('Resolved browser from env', { requested: raw, resolved: 'webkit' });
        return 'webkit';
      case 'edge':
        Log.debug('Resolved browser from env', { requested: raw, resolved: 'edge' });
        return 'edge';
      case 'chromium':
      case 'chrome':
        Log.debug('Resolved browser from env', { requested: raw, resolved: 'chromium' });
        return 'chromium';
      default:
        console.warn(
          `Unknown BROWSER="${raw}", defaulting to chromium. Use chromium|firefox|webkit|edge.`
        );
        Log.debug(`Unknown BROWSER="${raw}", defaulting to chromium. Use chromium|firefox|webkit|edge.`);
        return 'chromium';
    }
  }

  async openBrowser(
  browserName: SupportedBrowser,
  launchOptions: LaunchOptions = {}
): Promise<void> {
  if (browserName === 'firefox') {
    this.browser = await firefox.launch({
      ...launchOptions,
    });
    return;
  }

  if (browserName === 'webkit') {
    this.browser = await webkit.launch({
      ...launchOptions,
    });
    return;
  }

  if (browserName === 'edge') {
    this.browser = await chromium.launch({
      channel: 'msedge',
      ...launchOptions,
    });
    return;
  }

  this.browser = await chromium.launch({
    ...launchOptions,
  });
}


  async newContext(
    contextOptions: BrowserContextOptions = {}
  ): Promise<void> {
    if (!this.browser) {
      Log.error('Browser is not opened. Call openBrowser() first.');
      throw new Error('Browser is not opened. Call openBrowser() first.');
    }

    this.context = await this.browser.newContext({
      viewport: null,
      ...contextOptions,
    });

    this.page = await this.context.newPage();
    Log.info('New browser context and page created successfully.');
  }

  async closeContext(): Promise<void> {
    if (this.context) {
      await this.context.close();
      Log.info('Browser context closed successfully.');
      this.context = undefined;
      this.page = undefined;
    }
  }

  async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      Log.info('Browser closed successfully.');
      this.browser = undefined;
    }
  }
}
