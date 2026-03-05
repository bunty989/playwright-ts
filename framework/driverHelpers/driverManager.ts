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
import {
  resolveBrowserFromEnv,
  SupportedBrowser,
} from '../support/playwrightRuntimeConfig';

export { SupportedBrowser } from '../support/playwrightRuntimeConfig';

export class DriverManager {
  browser?: Browser;
  context?: BrowserContext;
  page?: Page;

  static resolveBrowserFromEnv(): SupportedBrowser {
    const resolved = resolveBrowserFromEnv();
    Log.debug('Resolved browser from runtime config/env', { resolved });
    return resolved;
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
        channel: launchOptions.channel ?? 'msedge',
        ...launchOptions,
      });
      return;
    }

    this.browser = await chromium.launch({
      ...launchOptions,
    });
  }

  async newContext(contextOptions: BrowserContextOptions = {}): Promise<void> {
    if (!this.browser) {
      Log.error('Browser is not opened. Call openBrowser() first.');
      throw new Error('Browser is not opened. Call openBrowser() first.');
    }

    this.context = await this.browser.newContext({
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
