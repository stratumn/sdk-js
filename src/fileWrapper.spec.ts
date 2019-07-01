/**
 * @jest-environment jsdom
 */
import { fixtures } from './fixtures';
import { FileWrapper } from './fileWrapper';
import { ReadStream } from 'fs';
describe('fileWrapper', () => {
  const {
    makeBrowserFile,
    nodeJsFileBlob,
    nodeJsFilePath,
    obj
  } = fixtures.FileWrappers;
  const browserFile = makeBrowserFile();

  it('NodeJs - FilePath', async () => {
    expect(nodeJsFilePath.data()).toBeInstanceOf(ReadStream);
    expect(await nodeJsFilePath.info()).toEqual({
      mimetype: 'image/png',
      name: 'stratumn.png',
      size: expect.any(Number)
    });
  });

  it('NodeJs - Blob', async () => {
    expect(nodeJsFileBlob.data()).toBeInstanceOf(Buffer);
    expect(await nodeJsFileBlob.info()).toEqual(obj);
  });

  it('Browser', async () => {
    expect(browserFile.data()).toBeInstanceOf(File);
    expect(await browserFile.info()).toEqual({
      mimetype: 'txt',
      name: 'novel.txt',
      size: expect.any(Number)
    });
  });

  it.each([
    ['NodeJsFilePath', nodeJsFilePath, true],
    ['NodeJsFileBlob', nodeJsFileBlob, true],
    ['BrowserFile', browserFile, true],
    ['string', 'abc', false],
    ['undefined', undefined, false],
    ['object', {}, false],
    ['boolean', true, false],
    ['number', 123, false]
  ])('isFileWrapper(%s)', (_name, obj, expected) => {
    expect(FileWrapper.isFileWrapper(obj)).toBe(expected);
  });
});
