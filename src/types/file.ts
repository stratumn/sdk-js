/**
 * A file information interface.
 */
export interface FileInfo {
  mimetype: string;
  size: number;
  name: string;
}

/**
 * A record of a file in the Media service.
 */
export interface MediaRecord {
  digest: string;
  name: string;
}
