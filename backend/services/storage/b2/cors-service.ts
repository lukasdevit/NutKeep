import { GetBucketCorsCommand, PutBucketCorsCommand, type CORSRule } from '@aws-sdk/client-s3';
import { getS3Client, getBucket } from './client.js';

/** Default safe CORS configuration for B2 browser uploads */
export const DEFAULT_CORS_RULES: CORSRule[] = [
  {
    AllowedHeaders: ['*'],
    AllowedMethods: ['PUT', 'GET', 'HEAD', 'DELETE', 'OPTIONS'],
    AllowedOrigins: ['*'],
    ExposeHeaders: ['ETag', 'Content-Length', 'Content-Type'],
    MaxAgeSeconds: 3600,
  },
];

const CORS_TIMEOUT_MS = 15_000;

/** Abort a promise after `ms` milliseconds */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

/**
 * Fetch the live CORS configuration directly from the B2 bucket.
 */
export async function getLiveCorsConfig(): Promise<CORSRule[] | null> {
  const s3 = await getS3Client();
  const bucket = await getBucket();

  try {
    const result = await withTimeout(
      s3.send(new GetBucketCorsCommand({ Bucket: bucket })),
      CORS_TIMEOUT_MS,
      'GetBucketCors',
    );
    return result.CORSRules ?? null;
  } catch (err) {
    const msg = (err as Error).message?.toLowerCase() ?? '';
    if (msg.includes('nosuchcorsconfiguration') || msg.includes('not found')) {
      return null;
    }
    throw err;
  }
}

/**
 * Apply CORS configuration to the B2 bucket via S3-compatible API.
 * Has a 15s timeout — if B2 doesn't respond, returns a clear error
 * instead of hanging until Cloudflare gives up.
 */
export async function applyLiveCorsConfig(rules: CORSRule[]): Promise<void> {
  const [s3, bucket] = await Promise.all([getS3Client(), getBucket()]);

  await withTimeout(
    s3.send(
      new PutBucketCorsCommand({
        Bucket: bucket,
        CORSConfiguration: { CORSRules: rules },
      })
    ),
    CORS_TIMEOUT_MS,
    'PutBucketCors',
  );
}
