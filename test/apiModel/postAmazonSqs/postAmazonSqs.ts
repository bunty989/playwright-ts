import { APIResponse, request } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { ApiHelper } from '../../../framework/playwrightHelpers/apiHelper';
import {
  AwsSignatureConfig,
  buildPayload,
  createSignedHeaders,
  resolveAwsConfig,
  resolveTargetUrl
} from '../../commonMethods';

type SqsPostOptions = {
  contentType?: string;
  additionalHeaders?: Record<string, string>;
  timeoutMs?: number;
  awsSignatureConfig?: Partial<AwsSignatureConfig>;
  amzTarget?: string;
};

export class PostAmazonSqs {
  private readonly apiHelper: ApiHelper;
  private response?: APIResponse;
  private baseUrl?: string;
  private readonly awsConfig?: Partial<AwsSignatureConfig>;

  constructor(
    apiHelper?: ApiHelper,
    awsConfig?: Partial<AwsSignatureConfig>
  ) {
    this.apiHelper = apiHelper ?? new ApiHelper();
    this.awsConfig = awsConfig;
  }

  async setupRequestAsync(baseUrl?: string): Promise<void> {
    this.baseUrl = baseUrl ?? process.env.AWS_SQS_BASE_URL;
  }

  async postToAmazonSqsAsync(
    endPoint: string,
    bodyOverride?: unknown,
    options?: SqsPostOptions
  ): Promise<APIResponse> {
    const targetUrl = resolveTargetUrl(endPoint, this.baseUrl);
    const contentType = options?.contentType ?? 'application/x-amz-json-1.0';
    const payload = buildPayload(bodyOverride, contentType, this.apiHelper);
    const signatureConfig = resolveAwsConfig(
      options?.awsSignatureConfig,
      this.awsConfig
    );
    const signedHeaders = createSignedHeaders(
      targetUrl,
      payload,
      contentType,
      signatureConfig,
      {
        ...(options?.amzTarget
          ? {
              'x-amz-target': options.amzTarget
            }
          : {}),
        ...(options?.additionalHeaders ?? {})
      }
    );

    const requestContext = await request.newContext({
      extraHTTPHeaders: signedHeaders,
      ignoreHTTPSErrors: true,
      timeout: options?.timeoutMs
    });

    this.response = await requestContext.post(targetUrl.toString(), {
      data: payload
    });

    return this.response;
  }

  validateResponseSchema(responseBody: string, schemaFileName: string): boolean {
    const schemaPath = path.resolve(__dirname, 'schemas', schemaFileName);
    const schemaContent = fs.readFileSync(schemaPath, 'utf8');
    return this.apiHelper.validateResponseSchema(responseBody, schemaContent);
  }
}
