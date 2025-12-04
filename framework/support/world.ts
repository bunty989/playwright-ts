import { IWorldOptions, setWorldConstructor, World } from '@cucumber/cucumber';
import { Browser, BrowserContext, Page } from 'playwright';
import { DriverManager, SupportedBrowser } from '../driverHelpers/driverManager';
import { APIResponse } from '@playwright/test';
import { ApiHelper } from '../playwrightHelpers/apiHelper';

export class CustomWorld extends World {
  browser?: Browser;
  context?: BrowserContext;
  page?: Page;
  driverManager: DriverManager;

  isApiTest = false;
  browserName: SupportedBrowser = process.env.BROWSER
    ? (process.env.BROWSER.toLowerCase() as SupportedBrowser)
    : 'chromium';

  apiResponse?: APIResponse;
  apiResponseBody?: string;
  apiEndpoint?: string;
  apiParamString?: string;
  fullRequestUrl?: string;
  requestQueryParams?: Record<string, any>;
  responseTimeMs?: number;
  apiHelper?: ApiHelper;

  errorLabels: string[] = [];
  currentErrorLabels: string[] = [];

  constructor(options: IWorldOptions) {
    super(options);
    this.driverManager = new DriverManager();
  }
}
setWorldConstructor(CustomWorld);
