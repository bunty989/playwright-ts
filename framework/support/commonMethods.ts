import { Faker, en_AU } from '@faker-js/faker';
import { DataType } from '../support/testConstant';

const faker = new Faker({ locale: [en_AU] });

/* =========================================================
   🇦🇺 AU POSTCODE ↔ STATE MAPPING
========================================================= */

type PostcodeRange = [number, number];

const AU_POSTCODE_RANGES: Record<string, PostcodeRange[]> = {
    NSW: [[1000, 2599], [2619, 2899]],
    ACT: [[200, 299], [2600, 2618], [2900, 2920]],
    VIC: [[3000, 3999], [8000, 8999]],
    QLD: [[4000, 4999], [9000, 9999]],
    SA: [[5000, 5799]],
    WA: [[6000, 6797]],
    TAS: [[7000, 7799]],
    NT: [[800, 899]]
};

export function generatePostcodeForState(state: string): string {
    const ranges = AU_POSTCODE_RANGES[state.toUpperCase()];
    if (!ranges) throw new Error(`Unsupported state: ${state}`);

    const [min, max] = ranges[Math.floor(Math.random() * ranges.length)];
    const code = Math.floor(Math.random() * (max - min + 1) + min);

    return code.toString().padStart(4, '0');
}

export function generateStateAndPostcode(): {
    state: string;
    postcode: string;
} {
    const states = Object.keys(AU_POSTCODE_RANGES);
    const state = states[Math.floor(Math.random() * states.length)];

    return {
        state,
        postcode: generatePostcodeForState(state)
    };
}

export function generateAustralianAddressBundle() {
    const { state, postcode } = generateStateAndPostcode();

    return {
        street: faker.location.streetAddress(),
        suburb: faker.location.city(),
        state,
        postcode,
        country: 'Australia'
    };
}

/* =========================================================
   📱 PHONE GENERATORS (Faker v8 compatible)
========================================================= */

function generateAustralianMobile(): string {
    return `04${faker.string.numeric(2)} ${faker.string.numeric(3)} ${faker.string.numeric(3)}`;
}

function generateAustralianLandline(): string {
    return faker.phone.number({ style: 'national' });
}

/* =========================================================
   🧪 TEST DATA GENERATOR (Enum-based)
========================================================= */

export function generateTestData(type: DataType): string {
    switch (type) {
        case DataType.Name:
            return faker.person.fullName();

        case DataType.FirstName:
            return faker.person.firstName();

        case DataType.LastName:
            return faker.person.lastName();

        case DataType.Gender:
            return faker.person.sex();

        case DataType.Email:
            return faker.internet.email();

        case DataType.Username:
            return faker.internet.username();

        case DataType.Password:
            return faker.internet.password({ length: 12 });

        case DataType.Phone:
            return generateAustralianLandline();

        case DataType.Mobile:
            return generateAustralianMobile();

        case DataType.Address: {
            const a = generateAustralianAddressBundle();
            return `${a.street}, ${a.suburb}, ${a.state} ${a.postcode}`;
        }

        case DataType.Street:
            return faker.location.streetAddress();

        case DataType.City:
            return faker.location.city();

        case DataType.State:
            return generateStateAndPostcode().state;

        case DataType.Postcode:
            return generateStateAndPostcode().postcode;

        case DataType.Country:
            return 'Australia';

        case DataType.Company:
            return faker.company.name();

        case DataType.JobTitle:
            return faker.person.jobTitle();

        case DataType.DateOfBirth:
            return faker.date.birthdate().toISOString().split('T')[0];

        case DataType.Age:
            return faker.number.int({ min: 18, max: 80 }).toString();

        case DataType.UUID:
            return faker.string.uuid();

        case DataType.URL:
            return faker.internet.url();

        case DataType.IP:
            return faker.internet.ip();

        default:
            throw new Error(`Unsupported DataType: ${type}`);
    }
}

/* =========================================================
   🧩 JSON SERIALIZATION (same as ApiHelper)
========================================================= */

export function serializeJson(obj: unknown): string {
    return JSON.stringify(obj, null, 2);
}

export function deserializeJson<T>(json: string): T {
    return JSON.parse(json) as T;
}

/* =========================================================
   🏗️ ENTERPRISE JSON MODIFIER
========================================================= */

export type JsonOperationType = 'add' | 'update' | 'delete';

export interface JsonOperation {
    path: string;
    operation?: JsonOperationType;
    value?: any;
}

export function modifyJson(
    jsonInput: unknown,
    operations: JsonOperation | JsonOperation[],
    strict: boolean = false
): unknown {
    const obj =
        typeof jsonInput === 'string'
            ? deserializeJson<any>(jsonInput)
            : JSON.parse(JSON.stringify(jsonInput));

    const ops = Array.isArray(operations) ? operations : [operations];

    for (const op of ops) {
        const { path, operation = 'add', value = null } = op;
        const tokens = tokenize(path);

        let current = obj;

        for (let i = 0; i < tokens.length - 1; i++) {
            const t = tokens[i];

            if (typeof t === 'number') {
                if (!Array.isArray(current)) {
                    if (strict) continue;
                    current = [];
                }
                if (!current[t]) current[t] = {};
                current = current[t];
            } else {
                if (!(t in current)) {
                    if (operation === 'delete' && strict) continue;
                    current[t] = {};
                }
                current = current[t];
            }
        }

        const last = tokens[tokens.length - 1];

        switch (operation) {
            case 'add':
            case 'update':
                if (typeof last === 'number') {
                    if (!Array.isArray(current)) current = [];
                    current[last] = value;
                } else {
                    current[last] = value;
                }
                break;

            case 'delete':
                if (typeof last === 'number') {
                    if (Array.isArray(current)) current.splice(last, 1);
                } else {
                    delete current[last];
                }
                break;
        }
    }

    return obj;
}

/* =========================================================
   🔍 PATH TOKENIZER
========================================================= */

function tokenize(path: string): (string | number)[] {
    const tokens: (string | number)[] = [];

    path.split('.').forEach(part => {
        const matches = part.match(/([^[\]]+)|\[(\d+)\]/g);
        if (matches) {
            matches.forEach(m => {
                if (m.startsWith('[')) {
                    tokens.push(Number(m.slice(1, -1)));
                } else {
                    tokens.push(m);
                }
            });
        }
    });

    return tokens;
}






import { APIResponse } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { ApiHelper } from '../../../framework/support/apiHelper';

import {
  deserializeJson,
  modifyJson
} from '../../../framework/common/commonMethods';

export class PostGenerateOTC {
  private readonly apiHelper: ApiHelper;

  /** Immutable request body per instance */
  private requestBody: unknown = null;

  private response?: APIResponse;

  constructor(apiHelper?: ApiHelper) {
    this.apiHelper = apiHelper ?? new ApiHelper();
  }

  // ---------------------------------------------------------
  // Setup request client (per scenario)
  // ---------------------------------------------------------
  async setupRequestAsync(): Promise<void> {
    const baseUrl =
      process.env.OTC_BASE_URL ||
      process.env.API_BASE_URL ||
      '';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: '*/*'
    };

    await this.apiHelper.setupApiRequestClient(baseUrl, headers);
  }

  // ---------------------------------------------------------
  // Load VALID request body (parallel-safe)
  // ---------------------------------------------------------
  setValidRequestBody(jsonPath: string): void {
    const raw = fs.readFileSync(path.resolve(jsonPath), 'utf8');

    // Deserialize into NEW object
    const base = deserializeJson<any>(raw);

    const randomId = Math.floor(
      100000 + Math.random() * 900000
    ).toString();

    this.requestBody = modifyJson(base, {
      path: 'data[0].party_id',
      operation: 'update',
      value: randomId
    });
  }

  // ---------------------------------------------------------
  // Load INVALID request body
  // ---------------------------------------------------------
  setInvalidRequestBody(
    jsonPath: string | null,
    nodeName?: string,
    nodeValue?: any
  ): void {
    if (!jsonPath) {
      this.requestBody = null;
      return;
    }

    const raw = fs.readFileSync(path.resolve(jsonPath), 'utf8');

    const base = deserializeJson<any>(raw);

    this.requestBody =
      nodeName !== undefined
        ? modifyJson(base, {
            path: nodeName,
            operation: 'update',
            value: nodeValue
          })
        : base;
  }

  // ---------------------------------------------------------
  // Update JSON safely (immutable)
  // ---------------------------------------------------------
  updateRequestBody(pathStr: string, newValue: any): void {
    if (!this.requestBody)
      throw new Error('Request body not initialized');

    this.requestBody = modifyJson(this.requestBody, {
      path: pathStr,
      operation: 'update',
      value: newValue
    });
  }

  // ---------------------------------------------------------
  // Remove node safely
  // ---------------------------------------------------------
  addRemoveBodyNodes(pathStr: string): void {
    if (!this.requestBody)
      throw new Error('Request body not initialized');

    this.requestBody = modifyJson(this.requestBody, {
      path: pathStr,
      operation: 'delete'
    });
  }

  // ---------------------------------------------------------
  // POST request
  // ---------------------------------------------------------
  async postGenerateOTCAsync(endpoint: string): Promise<APIResponse> {
    if (!this.requestBody)
      throw new Error('Request body not initialized');

    this.response = await this.apiHelper.postAsync(
      endpoint,
      this.requestBody
    );

    return this.response;
  }

  // ---------------------------------------------------------
  // Schema validation
  // ---------------------------------------------------------
  validateResponseSchema(
    responseBody: string,
    schemaPath: string
  ): boolean {
    const schemaContent = fs.readFileSync(
      path.resolve(schemaPath),
      'utf8'
    );

    return this.apiHelper.validateResponseSchema(
      responseBody,
      schemaContent
    );
  }
}



import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';

import { CustomWorld } from '../../framework/support/world';
import { ApiHelper } from '../../framework/playwrightHelpers/apiHelper';
import { PostGenerateOTC } from '../ApiModel/GenerateOTC/postGenerateOTC';

type WorldWithOTC = CustomWorld & {
  otcClient?: PostGenerateOTC;
};


// ============================================================
// VALID BODY
// ============================================================

Given(
  'I have the valid request header and body for {string} otc type to be sent to {string}',
  async function (
    this: WorldWithOTC,
    otcType: string,
    deliveryMethod: string
  ) {
    this.isApiTest = true;

    const apiHelper = new ApiHelper();
    this.apiHelper = apiHelper;

    const client = new PostGenerateOTC(apiHelper);
    await client.setupRequestAsync();

    const bodyPath =
      deliveryMethod.toLowerCase() === 'email'
        ? 'test/data/BodyEmail.json'
        : 'test/data/BodyMobile.json';

    client.setValidRequestBody(bodyPath);
    client.updateRequestBody('data[0].type_of_code', otcType);

    this.otcClient = client;
  }
);


// ============================================================
// INVALID BODY (missing node)
// ============================================================

Given(
  'I have the valid request header and invalid body with missing {string} for {string} otc type to be sent to {string}',
  async function (
    this: WorldWithOTC,
    missingNode: string,
    otcType: string,
    deliveryMethod: string
  ) {
    this.isApiTest = true;

    if (!this.otcClient) {
      const apiHelper = new ApiHelper();
      this.apiHelper = apiHelper;

      const client = new PostGenerateOTC(apiHelper);
      await client.setupRequestAsync();

      const bodyPath =
        deliveryMethod.toLowerCase() === 'email'
          ? 'test/data/BodyEmail.json'
          : 'test/data/BodyMobile.json';

      client.setValidRequestBody(bodyPath);

      this.otcClient = client;
    }

    this.otcClient.addRemoveBodyNodes(`data[0].${missingNode}`);
    this.otcClient.updateRequestBody('data[0].type_of_code', otcType);
  }
);


// ============================================================
// SEND REQUEST
// ============================================================

When(
  'I send a POST request to the Generate OTC endpoint',
  async function (this: WorldWithOTC) {
    if (!this.otcClient) throw new Error('OTC client not initialized');

    this.apiEndpoint = '/generate-otc'; // adjust if needed

    this.apiResponse = await this.otcClient.postGenerateOTCAsync(
      this.apiEndpoint
    );

    const helper = this.apiHelper ?? new ApiHelper();

    const body = await helper.getResponseBodyAsJson(this.apiResponse);

    this.apiResponseBody =
      typeof body === 'string' ? body : helper.serializeJson(body);
  }
);


// ============================================================
// SCHEMA VALIDATION
// ============================================================

Then(
  'the response should pass the schema for {string} of Generate OTC endpoint',
  function (this: WorldWithOTC, schemaName: string) {
    if (!this.apiResponseBody || !this.otcClient) {
      throw new Error('No response available for schema validation');
    }

    const schemaPath =
      `test/ApiModel/GenerateOTC/schemas/${schemaName}.json`;

    const isValid = this.otcClient.validateResponseSchema(
      this.apiResponseBody,
      schemaPath
    );

    expect(isValid).toBe(true);
  }
);