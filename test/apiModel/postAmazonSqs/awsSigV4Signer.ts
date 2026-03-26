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

  private encodeRFC3986(str: string): string {
    return encodeURIComponent(str)
      .replace(/[!*'()]/g, c =>
        '%' + c.charCodeAt(0).toString(16).toUpperCase()
      );
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
      .replace(/[:-]|\.\d{3}/g, '');

    const dateStamp = amzDate.substring(0, 8);

    const parsedUrl = new URL(url);

    const payloadHash = this.hash(body || '');

    // ✅ Normalize headers (LOWERCASE KEYS!)
    const headers: Record<string, string> = {};

    const baseHeaders = {
      host: parsedUrl.host,
      'content-type': extraHeaders['Content-Type'] || extraHeaders['content-type'],
      'x-amz-date': amzDate,
      'x-amz-content-sha256': payloadHash,
      ...(this.sessionToken && {
        'x-amz-security-token': this.sessionToken
      }),
      ...extraHeaders
    };

    Object.entries(baseHeaders).forEach(([k, v]) => {
      if (v !== undefined) {
        headers[k.toLowerCase()] = String(v).trim();
      }
    });

    // ✅ Sort headers
    const sortedHeaderKeys = Object.keys(headers).sort();

    const canonicalHeaders = sortedHeaderKeys
      .map(key => `${key}:${headers[key]}\n`)
      .join('');

    const signedHeaders = sortedHeaderKeys.join(';');

    // ✅ Canonical URI
    const canonicalUri = parsedUrl.pathname || '/';

    // ✅ Canonical Query String (sorted + encoded)
    const canonicalQuerystring = [...parsedUrl.searchParams.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${this.encodeRFC3986(k)}=${this.encodeRFC3986(v)}`)
      .join('&');

    // ✅ Canonical Request
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

    // 🔥 DEBUG LOGS (THIS IS GOLD)
    console.log('\n================ AWS SIGV4 DEBUG ================');
    console.log('\n--- REQUEST URL ---\n', url);
    console.log('\n--- PAYLOAD ---\n', body);
    console.log('\n--- PAYLOAD HASH ---\n', payloadHash);

    console.log('\n--- CANONICAL HEADERS ---\n', canonicalHeaders);
    console.log('\n--- SIGNED HEADERS ---\n', signedHeaders);

    console.log('\n--- CANONICAL REQUEST ---\n', canonicalRequest);
    console.log('\n--- STRING TO SIGN ---\n', stringToSign);

    console.log('\n--- FINAL SIGNATURE ---\n', signature);
    console.log('\n===============================================\n');

    return {
      headers: {
        ...headers,
        Authorization: authorizationHeader
      }
    };
  }
}