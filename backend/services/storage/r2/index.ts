import { Readable } from 'stream';
import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  ListMultipartUploadsCommand,
  AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getS3Client, getBucket } from './client.js';
import { R2_SETTING_KEYS } from './client.js';
import { registerProvider } from '../providers.js';
import type { StorageProvider } from '../types.js';

export class R2Storage implements StorageProvider {
  private s3Promise: ReturnType<typeof getS3Client> | null = null;

  private async s3() {
    if (!this.s3Promise) this.s3Promise = getS3Client();
    return this.s3Promise;
  }

  async save(key: string, stream: NodeJS.ReadableStream): Promise<number> {
    const [client, bucket] = await Promise.all([this.s3(), getBucket()]);
    const upload = new Upload({
      client,
      params: { Bucket: bucket, Key: key, Body: stream as Readable },
    });

    let uploadedBytes = 0;
    upload.on('httpUploadProgress', (progress) => {
      if (progress.loaded) uploadedBytes = progress.loaded;
    });

    await upload.done();
    return uploadedBytes;
  }

  async createReadStream(key: string): Promise<NodeJS.ReadableStream> {
    const [client, bucket] = await Promise.all([this.s3(), getBucket()]);
    const { Body } = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key })
    );
    return Body as NodeJS.ReadableStream;
  }

  async createReadStreamRange(
    key: string,
    start?: number,
    end?: number
  ): Promise<NodeJS.ReadableStream> {
    const [client, bucket] = await Promise.all([this.s3(), getBucket()]);
    const range =
      start !== undefined || end !== undefined
        ? `bytes=${start ?? ''}-${end ?? ''}`
        : undefined;
    const { Body } = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
        ...(range ? { Range: range } : {}),
      })
    );
    return Body as NodeJS.ReadableStream;
  }

  async size(key: string): Promise<number> {
    const [client, bucket] = await Promise.all([this.s3(), getBucket()]);
    const { ContentLength } = await client.send(
      new HeadObjectCommand({ Bucket: bucket, Key: key })
    );
    return ContentLength ?? 0;
  }

  async delete(key: string): Promise<void> {
    const [client, bucket] = await Promise.all([this.s3(), getBucket()]);
    await client.send(
      new DeleteObjectCommand({ Bucket: bucket, Key: key })
    );
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.size(key);
      return true;
    } catch {
      return false;
    }
  }

  async cleanupUnfinishedMultipart(): Promise<number> {
    const [client, bucket] = await Promise.all([this.s3(), getBucket()]);
    let count = 0;
    let keyMarker: string | undefined;
    let uploadIdMarker: string | undefined;

    do {
      const cmd = new ListMultipartUploadsCommand({
        Bucket: bucket,
        ...(keyMarker ? { KeyMarker: keyMarker } : {}),
        ...(uploadIdMarker ? { UploadIdMarker: uploadIdMarker } : {}),
      });
      const result = await client.send(cmd);

      if (result.Uploads) {
        for (const upload of result.Uploads) {
          if (upload.Key && upload.UploadId) {
            try {
              await client.send(
                new AbortMultipartUploadCommand({
                  Bucket: bucket,
                  Key: upload.Key,
                  UploadId: upload.UploadId,
                })
              );
              count++;
            } catch {
              /* already gone or permission issue — skip */
            }
          }
        }
      }

      if (result.IsTruncated) {
        keyMarker = result.NextKeyMarker;
        uploadIdMarker = result.NextUploadIdMarker;
      } else {
        break;
      }
    } while (true);

    return count;
  }

  async listKeys(prefix: string): Promise<string[]> {
    const [client, bucket] = await Promise.all([this.s3(), getBucket()]);
    const keys: string[] = [];
    let continuationToken: string | undefined;

    do {
      const { Contents, NextContinuationToken } = await client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        })
      );
      if (Contents) {
        for (const obj of Contents) {
          if (obj.Key) keys.push(obj.Key);
        }
      }
      continuationToken = NextContinuationToken;
    } while (continuationToken);

    return keys;
  }
}

registerProvider('r2', () => new R2Storage(), R2_SETTING_KEYS, '☁️ Cloudflare R2');
