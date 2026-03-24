import { APIResponse } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { ApiHelper } from '../../../framework/playwrightHelpers/apiHelper';
import { testConfig } from '../../config/testConfig';

export class GraphqlCountries {
  private apiHelper: ApiHelper;
  private response?: APIResponse;

  constructor(apiHelper?: ApiHelper) {
    this.apiHelper = apiHelper ?? new ApiHelper();
  }

  async setupRequestAsync(): Promise<void> {
    const baseUrl = testConfig.graphqlCountriesBaseUrl;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    };

    await this.apiHelper.setupApiRequestClient(baseUrl, headers);
  }

  async queryCountryAsync(
    endPoint: string,
    bodyOverride?: unknown
  ): Promise<APIResponse> {
    let data: unknown;

    if (bodyOverride !== undefined) {
      data = bodyOverride;
    } else {
      const bodyFilePath =
        process.env.GRAPHQL_COUNTRIES_BODY_PATH ||
        path.resolve(__dirname, 'body.json');

      const raw = fs.readFileSync(bodyFilePath, 'utf8');
      data = this.apiHelper.deserializeJson(raw);
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
