import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

import { CustomWorld } from '../../framework/support/world';
import { ApiHelper } from '../../framework/playwrightHelpers/apiHelper';
import { PostAmazonSqs } from '../apiModel/postAmazonSqs/postAmazonSqs';
import { AwsSignatureConfig } from '../commonMethods';

type WorldWithAmazonSqs = CustomWorld & {
  postAmazonSqsClient?: PostAmazonSqs;
  apiHelper?: ApiHelper;
  requestBodyRaw?: string;
  requestBody?: unknown;
  awsSignatureContext?: AwsSignatureConfig;
};

Given(
  'I have the endpoint {string} for Amazon SQS',
  async function (this: WorldWithAmazonSqs, endpoint: string) {
    this.apiEndpoint = endpoint;

    const apiHelper = new ApiHelper();
    this.apiHelper = apiHelper;

    const client = new PostAmazonSqs(apiHelper);
    await client.setupRequestAsync();

    this.postAmazonSqsClient = client;
  }
);

Given(
  'I have successfully captured AWS auth details from a previous API response for Amazon SQS',
  async function (this: WorldWithAmazonSqs) {
    // This step represents the handoff from a previous API call.
    // In a real flow, map these values from that earlier response instead of env vars.
    this.awsSignatureContext = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? 'captured-access-key-id',
      secretAccessKey:
        process.env.AWS_SECRET_ACCESS_KEY ?? 'captured-secret-access-key',
      sessionToken:
        process.env.AWS_SESSION_TOKEN ?? 'captured-session-token',
      region: process.env.AWS_REGION ?? 'ap-southeast-2',
      serviceName: process.env.AWS_SERVICE_NAME ?? 'sqs'
    };

    await this.attach(
      `Captured AWS auth context for SQS:\n${JSON.stringify(
        {
          accessKeyId: this.awsSignatureContext.accessKeyId,
          region: this.awsSignatureContext.region,
          serviceName: this.awsSignatureContext.serviceName,
          hasSessionToken: Boolean(this.awsSignatureContext.sessionToken)
        },
        null,
        2
      )}`,
      'text/plain'
    );
  }
);

Given(
  'I have the request body for Amazon SQS',
  async function (this: WorldWithAmazonSqs) {
    const bodyFilePath =
      process.env.POST_AMAZON_SQS_BODY_PATH ||
      path.resolve(process.cwd(), 'test', 'apiModel', 'postAmazonSqs', 'body.json');

    if (!fs.existsSync(bodyFilePath)) {
      throw new Error(`Amazon SQS body.json not found at: ${bodyFilePath}`);
    }

    const raw = fs.readFileSync(bodyFilePath, 'utf8');

    this.apiHelper = this.apiHelper ?? new ApiHelper();
    this.requestBodyRaw = raw;

    try {
      this.requestBody = JSON.parse(raw);
    } catch {
      this.requestBody = raw;
    }

    await this.attach(`Amazon SQS request body:\n${raw}`, 'text/plain');
  }
);

When(
  'I send a POST request to the Amazon SQS Url',
  async function (this: WorldWithAmazonSqs) {
    if (!this.postAmazonSqsClient) {
      throw new Error('Amazon SQS client not initialized');
    }

    if (!this.awsSignatureContext) {
      throw new Error(
        'AWS auth details are missing. Capture them from the previous API call before sending the SQS request.'
      );
    }

    this.apiResponse = await this.postAmazonSqsClient.postToAmazonSqsAsync(
      this.apiEndpoint!,
      this.requestBody,
      {
        awsSignatureConfig: this.awsSignatureContext,
        amzTarget: 'AmazonSQS.SendMessage'
      }
    );

    const helper = this.apiHelper ?? new ApiHelper();
    const body = await helper.getResponseBodyAsJson(this.apiResponse);
    this.apiResponseBody =
      typeof body === 'string' ? body : helper.serializeJson(body);
  }
);

Then(
  'the response should pass the schema for {string} for Amazon SQS',
  function (this: WorldWithAmazonSqs, responseSchemaName: string) {
    if (!this.apiResponseBody || !this.postAmazonSqsClient) {
      throw new Error('No response/client for Amazon SQS schema validation');
    }

    const schemaFile =
      responseSchemaName.includes('200')
        ? 'ResponseSchema200.json'
        : 'ResponseSchema200.json';

    const ok = this.postAmazonSqsClient.validateResponseSchema(
      this.apiResponseBody,
      schemaFile
    );
    expect(ok).toBe(true);
  }
);
