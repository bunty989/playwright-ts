import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { ApiHelper } from '../framework/playwrightHelpers/apiHelper';

export type AwsSignatureConfig = {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  region: string;
  serviceName: string;
};

export function resolveTargetUrl(endPoint: string, baseUrl?: string): URL {
  if (/^https?:\/\//i.test(endPoint)) {
    return new URL(endPoint);
  }

  if (!baseUrl) {
    throw new Error(
      'Amazon SQS base URL is missing. Set it via setupRequestAsync(baseUrl) or AWS_SQS_BASE_URL.'
    );
  }

  return new URL(endPoint, baseUrl);
}

export function buildPayload(
  bodyOverride: unknown,
  contentType: string,
  apiHelper: ApiHelper = new ApiHelper()
): string {
  const rawBody =
    bodyOverride !== undefined
      ? bodyOverride
      : readDefaultBodyFile(
          process.env.POST_AMAZON_SQS_BODY_PATH ||
            path.resolve(
              process.cwd(),
              'test',
              'apiModel',
              'postAmazonSqs',
              'body.json'
            ),
          apiHelper
        );

  if (typeof rawBody === 'string') {
    return rawBody;
  }

  if (rawBody instanceof URLSearchParams) {
    return rawBody.toString();
  }

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const entries = Object.entries(rawBody as Record<string, unknown>).map(
      ([key, value]) => [key, value == null ? '' : String(value)]
    );
    return new URLSearchParams(entries).toString();
  }

  return apiHelper.serializeJson(rawBody);
}

export function readDefaultBodyFile(
  bodyFilePath: string,
  apiHelper: ApiHelper = new ApiHelper()
): unknown {
  const raw = fs.readFileSync(bodyFilePath, 'utf8');

  try {
    return apiHelper.deserializeJson(raw);
  } catch {
    return raw;
  }
}

export function resolveAwsConfig(
  awsSignatureConfig?: Partial<AwsSignatureConfig>,
  fallbackAwsConfig?: Partial<AwsSignatureConfig>
): AwsSignatureConfig {
  const accessKeyId =
    awsSignatureConfig?.accessKeyId ??
    fallbackAwsConfig?.accessKeyId ??
    process.env.AWS_ACCESS_KEY_ID ??
    '';
  const secretAccessKey =
    awsSignatureConfig?.secretAccessKey ??
    fallbackAwsConfig?.secretAccessKey ??
    process.env.AWS_SECRET_ACCESS_KEY ??
    '';
  const sessionToken =
    awsSignatureConfig?.sessionToken ??
    fallbackAwsConfig?.sessionToken ??
    process.env.AWS_SESSION_TOKEN;
  const region =
    awsSignatureConfig?.region ??
    fallbackAwsConfig?.region ??
    process.env.AWS_REGION ??
    '';
  const serviceName =
    awsSignatureConfig?.serviceName ??
    fallbackAwsConfig?.serviceName ??
    process.env.AWS_SERVICE_NAME ??
    'sqs';

  if (!accessKeyId || !secretAccessKey || !region || !serviceName) {
    throw new Error(
      'AWS SigV4 config is incomplete. Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, and optionally AWS_SESSION_TOKEN/AWS_SERVICE_NAME.'
    );
  }

  return {
    accessKeyId,
    secretAccessKey,
    sessionToken,
    region,
    serviceName
  };
}

export function createSignedHeaders(
  targetUrl: URL,
  payload: string | Buffer,
  contentType: string,
  config: AwsSignatureConfig,
  additionalHeaders?: Record<string, string>
): Record<string, string> {
  const now = new Date();
  const amzDate = formatAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex(payload);

  const headers: Record<string, string> = {
    'content-type': contentType,
    host: targetUrl.host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
    ...(additionalHeaders ?? {})
  };

  if (config.sessionToken) {
    headers['x-amz-security-token'] = config.sessionToken;
  }

  const { canonicalHeaders, signedHeaders } = buildCanonicalHeaders(headers);
  const canonicalRequest = [
    'POST',
    encodeUriPath(targetUrl.pathname),
    buildCanonicalQueryString(targetUrl),
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n');

  const credentialScope = [
    dateStamp,
    config.region,
    config.serviceName,
    'aws4_request'
  ].join('/');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest)
  ].join('\n');

  const signingKey = getSignatureKey(
    config.secretAccessKey,
    dateStamp,
    config.region,
    config.serviceName
  );
  const signature = crypto
    .createHmac('sha256', signingKey)
    .update(stringToSign, 'utf8')
    .digest('hex');

  return {
    ...headers,
    Authorization: [
      `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}`,
      `SignedHeaders=${signedHeaders}`,
      `Signature=${signature}`
    ].join(', ')
  };
}

export function buildCanonicalHeaders(headers: Record<string, string>): {
  canonicalHeaders: string;
  signedHeaders: string;
} {
  const normalizedEntries = Object.entries(headers)
    .map(([key, value]) => [
      key.toLowerCase().trim(),
      value.toString().trim().replace(/\s+/g, ' ')
    ] as const)
    .sort(([left], [right]) => left.localeCompare(right));

  return {
    canonicalHeaders: normalizedEntries
      .map(([key, value]) => `${key}:${value}`)
      .join('\n')
      .concat('\n'),
    signedHeaders: normalizedEntries.map(([key]) => key).join(';')
  };
}

export function buildCanonicalQueryString(targetUrl: URL): string {
  return [...targetUrl.searchParams.entries()]
    .sort(([leftKey, leftValue], [rightKey, rightValue]) => {
      if (leftKey === rightKey) {
        return leftValue.localeCompare(rightValue);
      }

      return leftKey.localeCompare(rightKey);
    })
    .map(
      ([key, value]) => `${encodeRfc3986(key)}=${encodeRfc3986(value)}`
    )
    .join('&');
}

export function encodeUriPath(pathname: string): string {
  if (!pathname) {
    return '/';
  }

  return pathname
    .split('/')
    .map(segment => encodeRfc3986(segment))
    .join('/');
}

export function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

export function formatAmzDate(date: Date): string {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

export function sha256Hex(value: string | Buffer): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function getSignatureKey(
  secretAccessKey: string,
  dateStamp: string,
  region: string,
  serviceName: string
): Buffer {
  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, serviceName);
  return hmac(kService, 'aws4_request');
}

export function hmac(key: string | Buffer, value: string): Buffer {
  return crypto.createHmac('sha256', key).update(value, 'utf8').digest();
}
