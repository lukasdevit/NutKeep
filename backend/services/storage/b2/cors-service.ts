import { GetBucketCorsCommand, PutBucketCorsCommand, type CORSRule } from '@aws-sdk/client-s3';
import type { S3Client } from '@aws-sdk/client-s3';

/** Default safe CORS configuration for browser uploads */
export const DEFAULT_CORS_RULES: CORSRule[] = [
  {
    AllowedHeaders: ['*'],
    AllowedMethods: ['PUT', 'GET', 'HEAD', 'DELETE'],
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
 * Fetch the live CORS configuration directly from an S3-compatible bucket.
 */
export async function getLiveCorsConfig(s3: S3Client, bucket: string): Promise<CORSRule[] | null> {
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
 * Apply CORS configuration to an S3-compatible bucket.
 * Has a 15s timeout.
 */
export async function applyLiveCorsConfig(s3: S3Client, bucket: string, rules: CORSRule[]): Promise<void> {
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
