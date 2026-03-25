import crypto from 'crypto';

export class AwsSigV4Signer {
  private accessKey: string;
  private secretKey: string;
  private region: string;
  private service: string;
  private sessionToken?: string;

  constructor(
    accessKey: string,
    secretKey: string,
    region: string,
    service: string,
    sessionToken?: string
  ) {
    this.accessKey = accessKey;
    this.secretKey = secretKey;
    this.region = region;
    this.service = service;
    this.sessionToken = sessionToken;
  }

  private hash(value: string): string {
    return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
  }

  private hmac(key: Buffer | string, value: string): Buffer {
    return crypto.createHmac('sha256', key).update(value, 'utf8').digest();
  }

  private getSignatureKey(dateStamp: string): Buffer {
    const kDate = this.hmac(`AWS4${this.secretKey}`, dateStamp);
    const kRegion = this.hmac(kDate, this.region);
    const kService = this.hmac(kRegion, this.service);
    return this.hmac(kService, 'aws4_request');
  }

  public signRequest(
    method: string,
    url: string,
    body: string,
    extraHeaders: Record<string, string> = {}
  ) {
    const now = new Date();

    const amzDate = now
      .toISOString()
      .replace(/[:-]|\.\d{3}/g, ''); // YYYYMMDDTHHmmssZ

    const dateStamp = amzDate.substring(0, 8);

    const parsedUrl = new URL(url);

    const payloadHash = this.hash(body || '');

    // ✅ REQUIRED HEADERS
    const headers: Record<string, string> = {
      host: parsedUrl.host,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': payloadHash,
      ...extraHeaders
    };

    if (this.sessionToken) {
      headers['x-amz-security-token'] = this.sessionToken;
    }

    // ✅ SORT HEADERS (CRITICAL)
    const sortedHeaderKeys = Object.keys(headers)
      .map(h => h.toLowerCase())
      .sort();

    const canonicalHeaders = sortedHeaderKeys
      .map(key => `${key}:${headers[key].trim()}\n`)
      .join('');

    const signedHeaders = sortedHeaderKeys.join(';');

    const canonicalUri = parsedUrl.pathname || '/';

    // ✅ SORT QUERY PARAMS
    const canonicalQuerystring = [...parsedUrl.searchParams.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');

    const canonicalRequest = [
      method.toUpperCase(),
      canonicalUri,
      canonicalQuerystring,
      canonicalHeaders,
      signedHeaders,
      payloadHash
    ].join('\n');

    const credentialScope = `${dateStamp}/${this.region}/${this.service}/aws4_request`;

    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      this.hash(canonicalRequest)
    ].join('\n');

    const signingKey = this.getSignatureKey(dateStamp);

    const signature = crypto
      .createHmac('sha256', signingKey)
      .update(stringToSign, 'utf8')
      .digest('hex');

    const authorizationHeader = `AWS4-HMAC-SHA256 Credential=${this.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return {
      headers: {
        ...headers,
        Authorization: authorizationHeader
      }
    };
  }
}