// test/step-definitions/getWeather.steps.ts
import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../../framework/support/world';
import { ApiHelper } from '../../framework/playwrightHelpers/apiHelper';
import { GetWeatherById } from '../ApiModel/GetWeatherById/getWeatherById';
import { testConfig } from '../config/testConfig';

type WorldWithWeather = CustomWorld & {
  getWeatherClient?: GetWeatherById;
  apiHelper?: ApiHelper;
};

Given(
  'I have the endpoint {string} and the search param is {string} for GetWeatherById',
  async function (this: WorldWithWeather, endpoint: string, queryParams: string) {
    this.apiEndpoint = endpoint;
    this.apiParamString = queryParams;

    const apiHelper = new ApiHelper();
    this.apiHelper = apiHelper;

    const getWeather = new GetWeatherById(apiHelper);
    await getWeather.setupRequestAsync();

    this.getWeatherClient = getWeather;
  }
);

When(
  'I send a GET request to the GetWeatherById Url',
  async function (this: WorldWithWeather) {
    if (!this.getWeatherClient) throw new Error('GetWeather client not initialized');

    // parse query params 'lat=33.44;lon=-94.04'
    const parts = (this.apiParamString || '').split(';').filter(Boolean);
    const params: Record<string, string | number | boolean> = {};
    for (const p of parts) {
      const [k, v] = p.split('=');
      if (k && v !== undefined) params[k] = v;
    }

    const appId = testConfig.weatherApi_appId;
    if (appId) params['appid'] = appId;

    this.apiResponse = await this.getWeatherClient.getWeatherAsync(this.apiEndpoint!, params);

    // store body and meta for existing hooks/attachments
    const helper = this.apiHelper ?? new ApiHelper();
    const body = await helper.getResponseBodyAsJson(this.apiResponse);
    this.apiResponseBody = typeof body === 'string' ? body : helper.serializeJson(body);
  }
);

When(
  'I send a GET request to the GetWeatherById Url without the api key',
  async function (this: WorldWithWeather) {
    if (!this.getWeatherClient) {
      throw new Error('GetWeather client not initialized');
    }

    const parts = (this.apiParamString || '').split(';').filter(Boolean);
    const params: Record<string, string | number | boolean> = {};
    for (const p of parts) {
      const [k, v] = p.split('=');
      if (k && v !== undefined) {
        params[k] = v;
      }
    }

    this.apiResponse = await this.getWeatherClient.getWeatherAsync(
      this.apiEndpoint!,
      params,
      { includeApiKey: false }
    );

    const helper = this.apiHelper ?? new ApiHelper();
    const body = await helper.getResponseBodyAsJson(this.apiResponse);
    this.apiResponseBody =
      typeof body === 'string' ? body : helper.serializeJson(body);
  }
);


Then('the response should pass the schema for {string} for GetWeatherById', function (this: WorldWithWeather, responseSchemaName: string) {
  if (!this.apiResponseBody || !this.getWeatherClient) {
    throw new Error('No response or client for schema validation');
  }

  const schemaFile = responseSchemaName.includes('200')
    ? 'ResponseSchema200.json'
    : 'ResponseSchema401.json';

  const isValid = this.getWeatherClient.validateResponseSchema(this.apiResponseBody, schemaFile);
  expect(isValid).toBe(true);
});
