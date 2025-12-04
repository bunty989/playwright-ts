// test/step-definitions/postProducts.steps.ts
import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

import { CustomWorld } from '../../framework/support/world';
import { ApiHelper } from '../../framework/playwrightHelpers/apiHelper';
import { PostProducts } from '../apiModel/postProducts/postProducts';

type WorldWithPost = CustomWorld & {
  postClient?: PostProducts;
  apiHelper?: ApiHelper;
  requestBodyRaw?: string;
  requestBody?: unknown;
};

// 🔹 NEW STEP: binds "And I have the request body for Post Products"
Given(
  'I have the request body for Post Products',
  async function (this: WorldWithPost) {
    // Default body.json location, or override via env
    const bodyFilePath =
      process.env.POST_PRODUCTS_BODY_PATH ||
      path.resolve(process.cwd(), 'test', 'ApiModel', 'PostProducts', 'body.json');

    if (!fs.existsSync(bodyFilePath)) {
      throw new Error(`PostProducts body.json not found at: ${bodyFilePath}`);
    }

    const raw = fs.readFileSync(bodyFilePath, 'utf8');

    // Ensure ApiHelper exists
    this.apiHelper = this.apiHelper ?? new ApiHelper();

    // Store raw + parsed body on the world for later use
    this.requestBodyRaw = raw;

    try {
      this.requestBody = JSON.parse(raw);
    } catch {
      this.requestBody = raw; // if somehow not valid JSON
    }

    // Optional: attach to Allure
    await this.attach(`PostProducts request body:\n${raw}`, 'text/plain');
  }
);

Given(
  'I have the endpoint {string} for Post Products',
  async function (this: WorldWithPost, endpoint: string) {
    this.apiEndpoint = endpoint;

    const apiHelper = new ApiHelper();
    this.apiHelper = apiHelper;

    const client = new PostProducts(apiHelper);
    await client.setupRequestAsync();

    this.postClient = client;
  }
);

When(
  'I send a POST request to the Post Products Url',
  async function (this: WorldWithPost) {
    if (!this.postClient) throw new Error('PostProducts client not initialized');

    // If "I have the request body..." ran, prefer that body; otherwise let the model load body.json itself
    const bodyOverride = this.requestBody;

    this.apiResponse = await this.postClient.postProductsAsync(
      this.apiEndpoint!,
      bodyOverride
    );

    const helper = this.apiHelper ?? new ApiHelper();
    const body = await helper.getResponseBodyAsJson(this.apiResponse);
    this.apiResponseBody =
      typeof body === 'string' ? body : helper.serializeJson(body);
  }
);

Then(
  'the response should pass the schema for {string} for Post Products',
  function (this: WorldWithPost, responseSchemaName: string) {
    if (!this.apiResponseBody || !this.postClient)
      throw new Error('No response/client for schema validation');

    const schemaFile = responseSchemaName.includes('201')
      ? 'ResponseSchema201.json'
      : 'ResponseSchema201.json';

    const ok = this.postClient.validateResponseSchema(
      this.apiResponseBody,
      schemaFile
    );
    expect(ok).toBe(true);
  }
);
