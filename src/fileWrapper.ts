import { basename } from 'path';
import { stat, PathLike, readFile } from 'fs';
import { promisify } from 'util';
import to from 'await-to-js';
import uuid from 'uuid/v4';
import mime from 'mime';
import PromiseFileReader from 'promise-file-reader';
import { aes } from '@stratumn/js-crypto';
import { FileInfo, Identifiable } from './types';

// async version of fs.stat
const statAsync = promisify(stat);
const readFileAsync = promisify(readFile);

/**
 * A file wrapper is a file representation on the platform.
 * This class is abstract and has various concrete implementation
 * depending on the platform (Browser, NodeJs).
 */
export abstract class FileWrapper implements Identifiable {
  /**
   * A unique identifier of the file wrapper.
   * Satisfies the Identifiable constraint.
   */
  public id = uuid();

  public key?: aes.SymmetricKey;

  constructor(disableEncryption?: boolean, key?: string) {
    if (!disableEncryption) {
      this.key = new aes.SymmetricKey(key);
    }
  }

  protected encryptData(data: Buffer) {
    if (!this.key) {
      return data;
    }
    const encrypted = this.key.encrypt(data, 'binary');
    return Buffer.from(encrypted, 'base64');
  }

  protected decryptData(data: Buffer) {
    if (!this.key) {
      return data;
    }
    return Buffer.from(
      this.key.decrypt(data.toString('base64'), 'binary'),
      'base64'
    );
  }

  protected addKeyToFileInfo(info: FileInfo) {
    if (!this.key) {
      return info;
    }
    const { key } = this.key.export();
    return { ...info, key };
  }

  /**
   * Get the file info. This method is async
   * as in the NodeJs case, the info is retrieved
   * asynchronously using the statAsync function.
   */
  abstract async info(): Promise<FileInfo>;

  abstract async encryptedData(): Promise<Buffer>;

  abstract async decryptedData(): Promise<Buffer>;

  /**
   * Creates a FileWrapper from a browser file representation.
   *
   * @param file the browser File object
   */
  static fromBrowserFile(file: File): FileWrapper {
    return new BrowserFileWrapper(file);
  }

  /**
   * Creates a FileWrapper from a file path.
   *
   * @param fp the file path
   */
  static fromNodeJsFilePath(fp: PathLike): FileWrapper {
    return new NodeJsFilePathWrapper(fp);
  }

  /**
   * Creates a FileWrapper from a blob + info.
   *
   * @param blob the blob data
   * @param fileInfo the file info
   */
  static fromNodeJsFileBlob(blob: Buffer, fileInfo: FileInfo) {
    return new NodeJsFileBlobWrapper(blob, fileInfo);
  }

  /**
   * Tests that an object is a FileWrapper.
   *
   * @param obj the object to test.
   */
  static isFileWrapper(obj: any): obj is FileWrapper {
    return obj instanceof FileWrapper;
  }
}

/**
 * The browser implementation of a FileWrapper.
 */
class BrowserFileWrapper extends FileWrapper {
  private file: File;
  constructor(file: File) {
    super();
    this.file = file;
  }

  async info() {
    const { type: mimetype, size, name } = this.file;
    return this.addKeyToFileInfo({ mimetype, size, name });
  }

  private async data() {
    return Buffer.from(await PromiseFileReader.readAsArrayBuffer(this.file));
  }

  decryptedData = this.data;

  async encryptedData() {
    const data = await this.data();
    return super.encryptData(data);
  }
}

/**
 * The NodeJs implementation og a FileWrapper using
 * a file path to point to the actual file.
 */
class NodeJsFilePathWrapper extends FileWrapper {
  private filepath: PathLike;
  constructor(fp: PathLike) {
    super();
    this.filepath = fp;
  }

  async info() {
    const [err, fileStats] = await to(statAsync(this.filepath));

    if (err || !fileStats) {
      throw new Error(`Error while loading file ${this.filepath.toString()}`);
    }

    if (!fileStats.isFile()) {
      throw new Error(`${this.filepath.toString()} is not a valid file`);
    }

    const size = fileStats.size;
    const mimetype = mime.getType(this.filepath.toString()) || 'Unknown';
    const name = basename(this.filepath.toString());

    return this.addKeyToFileInfo({ mimetype, size, name });
  }

  private data() {
    return readFileAsync(this.filepath);
  }

  decryptedData = this.data;

  async encryptedData() {
    const data = await this.data();
    return super.encryptData(data);
  }
}

/**
 * The NodeJs implementation of a FileWrapper using
 * the blob and info to represent it.
 */
export class NodeJsFileBlobWrapper extends FileWrapper {
  private blob: Buffer;
  private fileInfo: FileInfo;

  constructor(blob: Buffer, fileInfo: FileInfo, disableEncryption?: boolean) {
    super(disableEncryption, fileInfo.key);
    this.blob = blob;
    this.fileInfo = fileInfo;
  }

  async info() {
    return this.fileInfo;
  }

  async decryptedData() {
    const decrypted = super.decryptData(this.blob);
    return Promise.resolve(decrypted);
  }

  async encryptedData() {
    return Promise.resolve(this.blob);
  }
}
