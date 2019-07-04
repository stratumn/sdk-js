import { basename } from 'path';
import { stat, PathLike, ReadStream, createReadStream } from 'fs';
import { promisify } from 'util';
import to from 'await-to-js';
import uuid from 'uuid/v4';
import mime from 'mime';
import { FileInfo, Identifiable } from './types';

// async version of fs.stat
const statAsync = promisify(stat);

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

  /**
   * Get the file info. This method is async
   * as in the NodeJs case, the info is retrieved
   * asynchronously using the statAsync function.
   */
  abstract async info(): Promise<FileInfo>;

  /**
   * The actual file data.
   */
  abstract data(): File | ReadStream | Buffer;

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
    return { mimetype, size, name };
  }

  data() {
    return this.file;
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

    return { mimetype, size, name };
  }

  data() {
    return createReadStream(this.filepath);
  }
}

/**
 * The NodeJs implementation of a FileWrapper using
 * the blob and info to represent it.
 */
class NodeJsFileBlobWrapper extends FileWrapper {
  private blob: Buffer;
  private fileInfo: FileInfo;
  constructor(blob: Buffer, fileInfo: FileInfo) {
    super();
    this.blob = blob;
    this.fileInfo = fileInfo;
  }
  async info() {
    return this.fileInfo;
  }
  data() {
    return this.blob;
  }
}
