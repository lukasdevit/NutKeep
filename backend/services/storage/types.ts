export interface StorageProvider {
  /** Save stream at key, return size in bytes */
  save(key: string, stream: NodeJS.ReadableStream): Promise<number>;
  /** Stream file back (full file) */
  createReadStream(key: string): Promise<NodeJS.ReadableStream>;
  /** Stream a byte range. If start/end are undefined, returns the full file. */
  createReadStreamRange(
    key: string,
    start?: number,
    end?: number
  ): Promise<NodeJS.ReadableStream>;
  /** Get file size */
  size(key: string): Promise<number>;
  /** Delete file */
  delete(key: string): Promise<void>;
  /** Does file exist? */
  exists(key: string): Promise<boolean>;
  /** Last modified timestamp in ms (optional — used for backup rotation). */
  mtime?(key: string): Promise<number>;
  /** List keys under a prefix (optional — rotate backups needs this). */
  listKeys?(prefix: string): Promise<string[]>;
  /** Clean up unfinished multipart uploads. Returns count of cleaned uploads. */
  cleanupUnfinishedMultipart?(): Promise<number>;
}
