import fs from 'fs';
import fsp from 'fs/promises';
import os from 'os';
import path from 'path';
import { pipeline } from 'stream/promises';
import { DEFAULT_UPLOAD_DIR } from '../../config/index.js';
import type { StorageProvider } from './types.js';

const CHUNK_DIR = path.join(os.tmpdir(), 'linqoy-chunks');

export class LocalStorage implements StorageProvider {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || DEFAULT_UPLOAD_DIR;
  }

  private resolve(key: string): string {
    if (path.isAbsolute(key) && key.startsWith(this.baseDir)) return key;

    const baseName = path.basename(this.baseDir);
    if (key.startsWith(baseName + path.sep) || key.startsWith(baseName + '/')) {
      const doubledPath = path.join(this.baseDir, key);
      // Legacy: file physically exists at the doubled path
      if (fs.existsSync(doubledPath)) return doubledPath;
      // New code: strip the redundant prefix
      return path.join(this.baseDir, key.slice(baseName.length + 1));
    }

    return path.join(this.baseDir, key);
  }

  async save(key: string, stream: NodeJS.ReadableStream): Promise<number> {
    const filepath = this.resolve(key);
    const dir = path.dirname(filepath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    await pipeline(stream, fs.createWriteStream(filepath));
    return fs.statSync(filepath).size;
  }

  async createReadStream(key: string): Promise<NodeJS.ReadableStream> {
    return fs.createReadStream(this.resolve(key));
  }

  async createReadStreamRange(
    key: string,
    start?: number,
    end?: number
  ): Promise<NodeJS.ReadableStream> {
    return fs.createReadStream(this.resolve(key), { start, end });
  }

  async size(key: string): Promise<number> {
    return fs.statSync(this.resolve(key)).size;
  }

  async delete(key: string): Promise<void> {
    try {
      fs.unlinkSync(this.resolve(key));
    } catch {
      /* already gone */
    }
  }

  async exists(key: string): Promise<boolean> {
    return fs.existsSync(this.resolve(key));
  }

  mtime(key: string): Promise<number> {
    return Promise.resolve(fs.statSync(this.resolve(key)).mtimeMs);
  }

  async listKeys(prefix: string): Promise<string[]> {
    const dir = path.dirname(this.resolve(prefix));
    if (!fs.existsSync(dir)) return [];
    const results: string[] = [];
    const base = this.baseDir;
    function walk(d: string) {
      for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
        const full = path.join(d, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else {
          results.push(path.relative(base, full));
        }
      }
    }
    walk(dir);
    return results;
  }

  async cleanupUnfinishedMultipart(): Promise<number> {
    if (!fs.existsSync(CHUNK_DIR)) return 0;
    const entries = await fsp.readdir(CHUNK_DIR, { withFileTypes: true });
    let count = 0;
    for (const entry of entries) {
      if (entry.isDirectory()) {
        await fsp.rm(path.join(CHUNK_DIR, entry.name), { recursive: true, force: true });
        count++;
      }
    }
    return count;
  }
}
