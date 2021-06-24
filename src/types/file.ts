/**
 * A file information interface.
 */
export interface FileInfo {
  mimetype: string;
  size: number;
  name: string;
  key?: string;
  createdAt?: Date;
}

/**
 * A record of a file in the Media service.
 */
export interface MediaRecord {
  digest: string;
  name: string;
}
