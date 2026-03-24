import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

import { CustomWorld } from '../../framework/support/world';
import { ApiHelper } from '../../framework/playwrightHelpers/apiHelper';
import { GraphqlCountries } from '../apiModel/graphqlCountries/graphqlCountries';

type WorldWithGraphqlCountries = CustomWorld & {
  graphqlCountriesClient?: GraphqlCountries;
  apiHelper?: ApiHelper;
  requestBodyRaw?: string;
  requestBody?: unknown;
};

Given(
  'I have the request body for GraphQL Countries',
  async function (this: WorldWithGraphqlCountries) {
    const bodyFilePath =
      process.env.GRAPHQL_COUNTRIES_BODY_PATH ||
      path.resolve(
        process.cwd(),
        'test',
        'apiModel',
        'graphqlCountries',
        'body.json'
      );

    if (!fs.existsSync(bodyFilePath)) {
      throw new Error(`GraphQL Countries body.json not found at: ${bodyFilePath}`);
    }

    const raw = fs.readFileSync(bodyFilePath, 'utf8');

    this.apiHelper = this.apiHelper ?? new ApiHelper();
    this.requestBodyRaw = raw;

    try {
      this.requestBody = JSON.parse(raw);
    } catch {
      this.requestBody = raw;
    }

    await this.attach(`GraphQL Countries request body:\n${raw}`, 'text/plain');
  }
);

Given(
  'I have the endpoint {string} for GraphQL Countries',
  async function (this: WorldWithGraphqlCountries, endpoint: string) {
    this.apiEndpoint = endpoint;

    const apiHelper = new ApiHelper();
    this.apiHelper = apiHelper;

    const client = new GraphqlCountries(apiHelper);
    await client.setupRequestAsync();

    this.graphqlCountriesClient = client;
  }
);

When(
  'I send a POST request to the GraphQL Countries Url',
  async function (this: WorldWithGraphqlCountries) {
    if (!this.graphqlCountriesClient) {
      throw new Error('GraphQL Countries client not initialized');
    }

    this.apiResponse = await this.graphqlCountriesClient.queryCountryAsync(
      this.apiEndpoint!,
      this.requestBody
    );

    const helper = this.apiHelper ?? new ApiHelper();
    const body = await helper.getResponseBodyAsJson(this.apiResponse);
    this.apiResponseBody =
      typeof body === 'string' ? body : helper.serializeJson(body);
  }
);

Then(
  'the response should pass the schema for {string} for GraphQL Countries',
  function (
    this: WorldWithGraphqlCountries,
    responseSchemaName: string
  ) {
    if (!this.apiResponseBody || !this.graphqlCountriesClient) {
      throw new Error('No response/client for GraphQL Countries schema validation');
    }

    const schemaFile =
      responseSchemaName.includes('200')
        ? 'ResponseSchema200.json'
        : 'ResponseSchema200.json';

    const ok = this.graphqlCountriesClient.validateResponseSchema(
      this.apiResponseBody,
      schemaFile
    );

    expect(ok).toBe(true);
  }
);
