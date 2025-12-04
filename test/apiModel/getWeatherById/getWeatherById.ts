import { APIResponse } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { ApiHelper } from '../../../framework/playwrightHelpers/apiHelper';
import { testConfig } from '../../config/testConfig';

export class GetWeatherById {
  private apiHelper: ApiHelper;
  private response?: APIResponse;

  constructor(apiHelper?: ApiHelper) {
    this.apiHelper = apiHelper ?? new ApiHelper();
  }

  async setupRequestAsync(): Promise<void> {
    const baseUrl = testConfig.baseUrl;
    const headers: Record<string, string> = {
      Accept: '*/*',
      'Accept-Encoding': 'gzip, deflate, br'
    };

    await this.apiHelper.setupApiRequestClient(baseUrl, headers);
  }

  async getWeatherAsync(
    endPoint: string,
    searchParams: Record<string, string | number | boolean>,
    options?: { includeApiKey?: boolean }
  ): Promise<APIResponse> {
    const includeApiKey = options?.includeApiKey ?? true;

    if (includeApiKey) {
      const appId = testConfig.weatherApi_appId;
      if (appId && !('appid' in searchParams)) {
        searchParams['appid'] = appId;
      }
    }

    this.response = await this.apiHelper.getAsync(endPoint, {
      params: searchParams
    });

    return this.response;
  }

  validateResponseSchema(responseBody: string, schemaFileName: string): boolean {
    const schemaPath = path.resolve(__dirname, 'schemas', schemaFileName);
    const schemaContent = fs.readFileSync(schemaPath, 'utf8');
    return this.apiHelper.validateResponseSchema(responseBody, schemaContent);
  }
}
