import { FileRecord } from './fileRecord';
import { fixtures } from './fixtures';

describe('FileRecord', () => {
  const { fileRecord, obj } = fixtures.FileRecords;
  it('fromObject', () => {
    expect(fileRecord).toBeInstanceOf(FileRecord);
  });

  it('id getter', () => {
    expect(fileRecord.id).toBe(obj.digest);
  });

  it.each([
    ['FileRecord', fileRecord, true],
    ['FileRecord data', obj, true],
    ['undefined', undefined, false],
    ['object', {}, false],
    ['boolean', true, false],
    ['number', 123, false]
  ])('isFileRecord(%s)', (_name, obj, expected) => {
    expect(FileRecord.isFileRecord(obj)).toBe(expected);
  });
});
