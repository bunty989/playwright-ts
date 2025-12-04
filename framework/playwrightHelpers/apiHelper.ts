import { request, APIRequestContext, APIResponse } from '@playwright/test';
import Ajv, { JSONSchemaType } from 'ajv';
import { JSONPath } from 'jsonpath-plus';
import { performance } from 'perf_hooks';
import { Log } from '../support/logger';

export class ApiHelper {
  private requestContext!: APIRequestContext;
  private ajv: Ajv;
  private baseUrl?: string;
  lastRequestUrl?: string;
  lastQueryParams?: Record<string, string | number | boolean>;
  lastResponseTimeMs?: number;

  constructor() {
    this.ajv = new Ajv({ allErrors: true, strict: false });
  }

  async setupApiRequestClient(
    baseUrl: string | undefined,
    headers: Record<string, string>,
    timeoutMs?: number
  ): Promise<void> {
    const timeoutFromEnv =
      Number(process.env.API_TIMEOUT_SECONDS || '30') * 1000;
    Log.debug('API Request Client setup', {
      baseUrl,
      timeoutFromEnv,
      headers
    });
    this.baseUrl = baseUrl;
    this.requestContext = await request.newContext({
      baseURL: baseUrl,
      extraHTTPHeaders: headers,
      timeout: timeoutMs ?? timeoutFromEnv,
      ignoreHTTPSErrors: true
    });
  }

private async requestWithMeta(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  endpoint: string,
  options: {
    params?: Record<string, string | number | boolean>;
    data?: unknown;
  } = {}
): Promise<APIResponse> {
  const start = performance.now();

  let response: APIResponse;
  switch (method) {
    case 'GET':
      response = await this.requestContext.get(endpoint, {
        params: options.params
      });
      break;
    case 'POST':
      response = await this.requestContext.post(endpoint, {
        params: options.params,
        data: options.data
      });
      break;
    case 'PUT':
      response = await this.requestContext.put(endpoint, {
        params: options.params,
        data: options.data
      });
      break;
    case 'PATCH':
      response = await this.requestContext.patch(endpoint, {
        params: options.params,
        data: options.data
      });
      break;
    case 'DELETE':
      response = await this.requestContext.delete(endpoint, {
        params: options.params
      });
      break;
  }

  const end = performance.now();
  this.lastResponseTimeMs = Math.round(end - start);

  // Build full URL (baseUrl + endpoint + query params)
  if (this.baseUrl) {
    const url = new URL(endpoint, this.baseUrl);
    if (options.params) {
      this.lastQueryParams = options.params;
      for (const [k, v] of Object.entries(options.params)) {
        url.searchParams.append(k, String(v));
      }
    } else {
      this.lastQueryParams = undefined;
    }
    this.lastRequestUrl = url.toString();
  } else {
    this.lastRequestUrl = undefined;
    this.lastQueryParams = options.params;
  }

  console.debug(
    `${method} ${endpoint} -> ${response.status()}, time: ${this.lastResponseTimeMs}ms`
  );
  Log.debug(`${method} request completed`, {
    url: this.lastRequestUrl,
    status: response.status(),
    responseTimeMs: this.lastResponseTimeMs
  });
  Log.info(`Response Body: ${await response.text()}`);
  return response;
}


  // GET request
  async getAsync(
  endpoint: string,
  options?: { params?: Record<string, string | number | boolean> }
): Promise<APIResponse> {
  return this.requestWithMeta('GET', endpoint, {
    params: options?.params
  });
  
}


  // POST request
  async postAsync(
  endpoint: string,
  body?: unknown,
  params?: Record<string, string | number | boolean>
): Promise<APIResponse> {
  return this.requestWithMeta('POST', endpoint, {
    data: body,
    params
  });
}


  // PUT request
  async putAsync(
  endpoint: string,
  body?: unknown,
  params?: Record<string, string | number | boolean>
): Promise<APIResponse> {
  return this.requestWithMeta('PUT', endpoint, {
    data: body,
    params
  });
}


  // PATCH request
  async patchAsync(
  endpoint: string,
  body?: unknown,
  params?: Record<string, string | number | boolean>
): Promise<APIResponse> {
  return this.requestWithMeta('PATCH', endpoint, {
    data: body,
    params
  });
}


  // DELETE request
  async deleteAsync(
  endpoint: string,
  params?: Record<string, string | number | boolean>
): Promise<APIResponse> {
  return this.requestWithMeta('DELETE', endpoint, {
    params
  });
}

  serializeJson(obj: unknown): string {
    return JSON.stringify(obj, null, 2);
  }

  deserializeJson<T>(json: string): T {
    return JSON.parse(json) as T;
  }

  validateResponseSchema(
    responseContent: string,
    schemaContent: string
  ): boolean {
    const schema = JSON.parse(schemaContent) as any;

    if (schema.$schema) {
      delete schema.$schema;
    }

    const validate = this.ajv.compile(schema);
    const data = JSON.parse(responseContent);

    const valid = validate(data);
    if (!valid) {
      Log.error('Schema validation errors:', { errors: validate.errors });
    }
    Log.info('Schema validation result', { valid: valid });
    return !!valid;
  }


  getStatusCode(response: APIResponse): number {
    const statusCode = response.status();
    Log.info('Response status code', { statusCode: statusCode });
    return statusCode;
  }

  async getResponseBodyAsJson(response: APIResponse): Promise<unknown> {
    const text = await response.text();
    const contentType =
      response.headers()['content-type'] ||
      response.headers()['Content-Type'] ||
      '';

    if (contentType.includes('application/json')) {
      try {
        const json = JSON.parse(text);
        Log.info('Response body', { json });
        return json;
      } catch (err) {
        Log.error('Failed to parse JSON response. Raw body:', { text });
        throw err;
      }
    }

    Log.warn('Non-JSON response body', { text });
    return text;
  }

  findJsonNodeValueByPath(
    jsonString: string,
    keyPath: string,
    returnMultiple = false
  ): unknown {
    try {
      const obj = JSON.parse(jsonString);
      const result = JSONPath({
        path: keyPath,
        json: obj,
        resultType: 'value'
      }) as unknown[];

      if (returnMultiple) {
        return result.map(v => (v != null ? String(v) : null));
      }

      return result.length > 0 ? String(result[0]) : null;
    } catch (err) {
      Log.error('Error while searching JSON:', { err });
      return returnMultiple ? [] : null;
    }
  }
}
