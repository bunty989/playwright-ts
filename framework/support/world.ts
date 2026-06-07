import { IWorldOptions, setWorldConstructor, World } from '@cucumber/cucumber';
import { Browser, BrowserContext, Page } from 'playwright';
import { DriverManager, SupportedBrowser } from '../driverHelpers/driverManager';
import { APIResponse } from '@playwright/test';
import { ApiHelper } from '../playwrightHelpers/apiHelper';

export interface CapturedUiNetworkResponse {
  matchedRoutePath: string;
  url: string;
  method: string;
  resourceType: string;
  status: number;
  statusText: string;
  contentType?: string;
  requestPostData?: string | null;
  responseBody?: string;
  responseBodyTruncated?: boolean;
  error?: string;
}

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
  uiNetworkRoutePaths: string[] = [];
  uiNetworkResponses: CapturedUiNetworkResponse[] = [];
  uiNetworkCaptureTasks: Promise<void>[] = [];

  errorLabels: string[] = [];
  currentErrorLabels: string[] = [];

  constructor(options: IWorldOptions) {
    super(options);
    this.driverManager = new DriverManager();
  }

  captureUiNetworkResponsesForRoutePaths(...routePaths: string[]): void {
    const normalizedRoutePaths = routePaths
      .map(routePath => routePath.trim())
      .filter(Boolean);

    this.uiNetworkRoutePaths.push(...normalizedRoutePaths);
  }
}
setWorldConstructor(CustomWorld);
