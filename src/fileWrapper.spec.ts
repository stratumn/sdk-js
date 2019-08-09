/**
 * @jest-environment jsdom
 */
import { fixtures } from './fixtures';
import { FileWrapper } from './fileWrapper';
describe('fileWrapper', () => {
  const {
    makeBrowserFile,
    nodeJsFileBlob,
    nodeJsFilePath,
    obj
  } = fixtures.FileWrappers;
  const browserFile = makeBrowserFile();

  it('NodeJs - FilePath', async () => {
    expect(await nodeJsFilePath.info()).toEqual({
      mimetype: 'image/png',
      name: 'stratumn.png',
      size: expect.any(Number),
      key: expect.any(String)
    });
  });

  it('NodeJs - Blob', async () => {
    expect(await nodeJsFileBlob.info()).toEqual(obj);
  });

  it('Browser', async () => {
    expect(await browserFile.info()).toEqual({
      mimetype: 'txt',
      name: 'novel.txt',
      size: expect.any(Number),
      key: expect.any(String)
    });
  });

  it.each([['NodeJsFilePath', nodeJsFilePath], ['BrowserFile', browserFile]])(
    'Encryption / Decryption : %s',
    async (_name: string, obj: FileWrapper) => {
      const encrypted = await obj.encryptedData();
      const decrypted = await obj.decryptedData();
      expect(encrypted).not.toEqual(decrypted);
      const info = await obj.info();
      const fileBlob = FileWrapper.fromNodeJsFileBlob(encrypted, info);
      expect(await fileBlob.decryptedData()).toEqual(decrypted);
    }
  );

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
