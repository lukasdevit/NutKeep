import { S3Client, type S3ClientConfig } from '@aws-sdk/client-s3';
import { getStorageSetting } from '../../../config/index.js';
import { ensureBucketCors as setBucketCors } from '../s3-cors.js';

/** Admin-configurable setting keys for this provider (prefixed). */
export const B2_SETTING_KEYS = ['b2_endpoint', 'b2_region', 'b2_bucket', 'b2_key_id', 'b2_app_key'] as const;

// B2 defaults — only used when no DB/env override
const DEFAULTS = {
  endpoint: 'https://s3.eu-central-003.backblazeb2.com',
  region: 'eu-central-003',
  bucket: 'my-bucket-name',
  prefix: 'linqoy/storage/',
} as const;

let _s3Client: S3Client | null = null;

export async function getS3Client(): Promise<S3Client> {
  if (!_s3Client) {
    const [endpoint, region, keyId, appKey] = await Promise.all([
      getStorageSetting('endpoint'),
      getStorageSetting('region'),
      getStorageSetting('key_id'),
      getStorageSetting('app_key'),
    ]);

    if (!keyId || !appKey) {
      throw new Error('Storage credentials not configured — key_id and app_key required');
    }

    const resolvedEndpoint = endpoint || DEFAULTS.endpoint;
    const url = resolvedEndpoint.startsWith('http')
      ? resolvedEndpoint
      : `https://${resolvedEndpoint}`;

    const config: S3ClientConfig = {
      credentials: {
        accessKeyId: keyId,
        secretAccessKey: appKey,
      },
      forcePathStyle: true,
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    };
    if (region) config.region = region;
    config.endpoint = url;

    _s3Client = new S3Client(config);
  }
  return _s3Client;
}

/** Get the bucket name, respecting admin panel override */
let _cachedBucket: string | null = null;
export async function getBucket(): Promise<string> {
  if (!_cachedBucket) {
    _cachedBucket = await getStorageSetting('bucket') || DEFAULTS.bucket;
  }
  return _cachedBucket;
}

/**
 * Ensure CORS is configured on the B2 bucket so browsers can PUT parts directly
 * via presigned URLs. Runs once at startup, safe to call multiple times.
 */
export async function ensureBucketCors(): Promise<void> {
  const [client, bucket] = await Promise.all([getS3Client(), getBucket()]);
  await setBucketCors(client, bucket, 'B2');
}
