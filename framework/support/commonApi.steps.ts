import { When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from './world';
import { ApiHelper } from '../playwrightHelpers/apiHelper';

type WorldWithHelper = CustomWorld & { apiHelper?: ApiHelper };

When(
  'I should get a response for the api call',
  async function (this: WorldWithHelper) {
    if (!this.apiResponse) {
      throw new Error('No API response found in world context');
    }

    if (this.apiHelper) {
      this.fullRequestUrl = this.apiHelper.lastRequestUrl;
      this.requestQueryParams = this.apiHelper.lastQueryParams;
      this.responseTimeMs = this.apiHelper.lastResponseTimeMs;
    }

    const apiHelper = new ApiHelper();
    const body = await apiHelper.getResponseBodyAsJson(this.apiResponse);

    if (typeof body === 'string') {
      this.apiResponseBody = body;
    } else {
      this.apiResponseBody = apiHelper.serializeJson(body);
    }
  }
);

Then(
  'the response status code should be {int}',
  function (this: CustomWorld, statusCode: number) {
    if (!this.apiResponse) {
      throw new Error('No API response found in world context');
    }

    const apiHelper = new ApiHelper();
    const actualStatus = apiHelper.getStatusCode(this.apiResponse);
    expect(actualStatus).toBe(statusCode);
  }
);

Then(
  'the value of the {string} is {string} in the response',
  function (this: CustomWorld, keyNode: string, nodeValue: string) {
    if (!this.apiResponseBody) {
      throw new Error('No API response body found in world context');
    }

    const apiHelper = new ApiHelper();
    const value = apiHelper.findJsonNodeValueByPath(
      this.apiResponseBody,
      keyNode
    );

    expect(value).toBe(nodeValue);
  }
);

Then(
  "the response should be within '{int}' ms",
  async function (this: CustomWorld, expectedMs: number) {
    if (this.responseTimeMs === undefined) {
      throw new Error(
        'Response time not recorded. Ensure this step runs AFTER "I should get a response for the api call".'
      );
    }

    await this.attach(
      `Actual Response Time: ${this.responseTimeMs} ms (limit: ${expectedMs} ms)`,
      'text/plain'
    );

    expect(this.responseTimeMs).toBeLessThanOrEqual(expectedMs);
  }
);
