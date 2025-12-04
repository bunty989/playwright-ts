import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../../framework/support/world';
import { ApiHelper } from '../../framework/playwrightHelpers/apiHelper';
import { GetWeather } from '../apiModel/getWeather/getWeather';
import { testConfig } from '../config/testConfig';

type WorldWithWeather = CustomWorld & { getWeatherClient?: GetWeather; apiHelper?: ApiHelper };

Given(
  'I have the endpoint {string} and the search param is {string} for GetWeather',
  async function (
    this: WorldWithWeather,
    endpoint: string,
    queryParams: string
  ) {
    this.apiEndpoint = endpoint;   
    this.apiParamString = queryParams;

    const apiHelper = new ApiHelper();
    this.apiHelper = apiHelper;  

    const getWeather = new GetWeather(apiHelper);
    await getWeather.setupRequestAsync();

    this.getWeatherClient = getWeather;
  }
);

When(
  'I send a GET request to the GetWeather Url',
  async function (this: WorldWithWeather) {
    if (!this.apiEndpoint || !this.apiParamString || !this.getWeatherClient) {
      throw new Error('Endpoint, query params or client not set in world');
    }

    const appId = testConfig.weatherApi_appId;
    
    if (!appId) {
      throw new Error(
        'WEATHER_APP_ID is missing. Please set it in your ../config/testConfig.ts at project root.'
      );
    }

    const parts = this.apiParamString.split(';');

    const searchParams: Record<string, string | number | boolean> = {
      [parts[0].split('=')[0]]: parts[0].split('=')[1],
      [parts[1].split('=')[0]]: parts[1].split('=')[1],
      appid: appId
    };

    this.apiResponse = await this.getWeatherClient.getWeatherAsync(
      this.apiEndpoint,
      searchParams
    );
  }
);


When(
  'I send a GET request to the GetWeather Url without the api key',
  async function (this: WorldWithWeather) {
    if (!this.apiEndpoint || !this.apiParamString || !this.getWeatherClient) {
      throw new Error('Endpoint, query params or client not set in world');
    }

    const parts = this.apiParamString.split(';');
    const searchParams: Record<string, string | number | boolean> = {
      [parts[0].split('=')[0]]: parts[0].split('=')[1],
      [parts[1].split('=')[0]]: parts[1].split('=')[1]
      // intentionally no appid here
    };

    this.apiResponse = await this.getWeatherClient.getWeatherAsync(
      this.apiEndpoint,
      searchParams
    );
  }
);

Then(
  'the response should pass the schema for {string} for GetWeather',
  function (this: WorldWithWeather, responseSchemaName: string) {
    if (!this.apiResponseBody || !this.getWeatherClient) {
      throw new Error('No API response body or client found in world context');
    }

    const schemaFile =
      responseSchemaName.includes('200')
        ? 'ResponseSchema200.json'
        : 'ResponseSchema401.json';

    const isValid = this.getWeatherClient.validateResponseSchema(
      this.apiResponseBody,
      schemaFile
    );

    expect(isValid).toBe(true);
  }
);
