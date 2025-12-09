import  { APIResponse } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { ApiHelper } from '../../../framework/playwrightHelpers/apiHelper';
import { testConfig } from '../../config/testConfig';

export class PostProducts {
  private apiHelper: ApiHelper;
  private response?: APIResponse;

  constructor(apiHelper?: ApiHelper) {
    this.apiHelper = apiHelper ?? new ApiHelper();
  }

  async setupRequestAsync(): Promise<void> {
    const baseUrl = testConfig.postProductsBaseUrl ;
    const headers: Record<string, string> = {
      Accept: '*/*',
      'Accept-Encoding': 'gzip, deflate, br',
      'Content-Type': 'application/json'
    };

    await this.apiHelper.setupApiRequestClient(baseUrl, headers);
  }

  async postProductsAsync(
    endPoint: string,
    bodyOverride?: unknown
  ): Promise<APIResponse> {
    let data: unknown;

    if (bodyOverride !== undefined) {
      data = bodyOverride;
    } else {
      const bodyFilePath =
        process.env.POST_PRODUCTS_BODY_PATH ||
        path.resolve(__dirname, 'body.json');

      const raw = fs.readFileSync(bodyFilePath, 'utf8');
      data = this.apiHelper.deserializeJson<any>(raw);
    }

    this.response = await this.apiHelper.postAsync(endPoint, data);
    return this.response;
  }

  validateResponseSchema(responseBody: string, schemaFileName: string): boolean {
    const schemaPath = path.resolve(__dirname, 'schemas', schemaFileName);
    const schemaContent = fs.readFileSync(schemaPath, 'utf8');
    return this.apiHelper.validateResponseSchema(responseBody, schemaContent);
  }
}
