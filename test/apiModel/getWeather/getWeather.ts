// test/ApiModel/Getweather/getWeather.ts
import test, { APIResponse } from '@playwright/test';
import { ApiHelper } from '../../../framework/playwrightHelpers/apiHelper';
import * as fs from 'fs';
import * as path from 'path';
import { testConfig } from '../../config/testConfig';

export class GetWeather {
  private apiHelper: ApiHelper;
  private response?: APIResponse;
  private baseUrlUsed = '';

  constructor(apiHelper?: ApiHelper) {
    this.apiHelper = apiHelper ?? new ApiHelper();
  }

  async setupRequestAsync(): Promise<void> {
    const baseUrl = testConfig.baseUrl ;
    this.baseUrlUsed = baseUrl;

    const headers: Record<string, string> = {
      Accept: '*/*',
      'Accept-Encoding': 'gzip, deflate, br'
    };

    await this.apiHelper.setupApiRequestClient(baseUrl, headers);
  }

  async getWeatherAsync(
    endPoint: string,
    searchParams: Record<string, string | number | boolean>
  ): Promise<APIResponse> {

    this.response = await this.apiHelper.getAsync(endPoint, {
      params: searchParams
    });

    return this.response;
  }

  validateResponseSchema(
    responseBody: string,
    schemaFileName: string
  ): boolean {
    const schemaPath = path.resolve(__dirname, 'schemas', schemaFileName);
    const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
    return this.apiHelper.validateResponseSchema(responseBody, schemaContent);
  }
}
