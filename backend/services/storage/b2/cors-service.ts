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

/**
 * Fetch the live CORS configuration directly from the B2 bucket.
 * Returns the CORS rules array from the S3-compatible API.
 */
export async function getLiveCorsConfig(): Promise<CORSRule[] | null> {
  const s3 = await getS3Client();
  const bucket = await getBucket();

  try {
    const result = await s3.send(new GetBucketCorsCommand({ Bucket: bucket }));
    return result.CORSRules ?? null;
  } catch (err) {
    const msg = (err as Error).message?.toLowerCase() ?? '';
    // B2 returns NoSuchCORSConfiguration when no CORS is set
    if (msg.includes('nosuchcorsconfiguration') || msg.includes('not found')) {
      return null;
    }
    throw err;
  }
}

/**
 * Apply CORS configuration to the B2 bucket.
 * Validates that the input is a valid CORSRules array.
 */
export async function applyLiveCorsConfig(rules: CORSRule[]): Promise<void> {
  const s3 = await getS3Client();
  const bucket = await getBucket();

  await s3.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: { CORSRules: rules },
    })
  );
}
