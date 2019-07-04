import { FileInfo, MediaRecord, Identifiable } from './types';

/**
 * A file record contains file information (FileInfo)
 * and Media service record information (MediaRecord).
 * It corresponds to a file stored in the Media service.
 */
export class FileRecord implements MediaRecord, FileInfo, Identifiable {
  digest: string;
  name: string;
  mimetype: string;
  size: number;

  constructor(media: MediaRecord, info: FileInfo) {
    const { digest, name } = media;
    const { mimetype, size } = info;
    this.digest = digest;
    this.name = name;
    this.mimetype = mimetype;
    this.size = size;
  }

  /**
   * This getter implements the Identifiable interface.
   */
  public get id() {
    return this.digest;
  }

  /**
   * Creates a FileRecord from an object.
   *
   * @param obj the object record + info
   */
  static fromObject(obj: MediaRecord & FileInfo) {
    return new FileRecord(obj, obj);
  }

  /**
   * Test if the object is a FileRecord
   *
   * @param obj the object to test.
   */
  static isFileRecord(obj: any): obj is FileRecord {
    return (
      obj instanceof FileRecord ||
      (!!obj &&
        obj.digest !== undefined &&
        obj.name !== undefined &&
        obj.mimetype !== undefined &&
        obj.size !== undefined)
    );
  }
}
