import { S3Client, PutBucketCorsCommand } from '@aws-sdk/client-s3';

/**
 * Shared helper — sets CORS on an S3-compatible bucket so browsers can PUT parts
 * directly via presigned URLs (used by both B2 and R2).
 */
export async function ensureBucketCors(
  client: S3Client,
  bucket: string,
  label: string,
): Promise<void> {
  try {
    await client.send(
      new PutBucketCorsCommand({
        Bucket: bucket,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedHeaders: ['*'],
              AllowedMethods: ['PUT', 'GET', 'HEAD', 'DELETE', 'OPTIONS'],
              AllowedOrigins: ['*'],
              ExposeHeaders: ['ETag', 'Content-Length', 'Content-Type'],
              MaxAgeSeconds: 3600,
            },
          ],
        },
      }),
    );
    console.warn(`${label} CORS configuration applied`);
  } catch (err) {
    console.warn(`Failed to configure ${label} CORS:`, (err as Error).message);
  }
}
