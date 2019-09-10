/**
 * @jest-environment jsdom
 */
import { sig, utils } from '@stratumn/js-crypto';
import {
  makeEndpoints,
  makeAuthPayload,
  extractFileWrappers,
  assignObjects,
  extractFileRecords
} from './helpers';
import { fixtures } from './fixtures';
import { FileWrapper } from './fileWrapper';
import { FileRecord } from './fileRecord';

const { pemPrivateKey, pemPublicKey } = fixtures.signingKey;
const {
  nodeJsFileBlob,
  nodeJsFilePath,
  makeBrowserFile
} = fixtures.FileWrappers;
const browserFile = makeBrowserFile();

/**
 * Make the endpoints object
 */
describe('makeEndpoints', () => {
  /**
   * no args defaults to release
   */
  it('with no arg', () => {
    expect(makeEndpoints()).toMatchInlineSnapshot(`
      Object {
        "account": "https://account-api.stratumn.com",
        "media": "https://media-api.stratumn.com",
        "trace": "https://trace-api.stratumn.com",
      }
    `);
  });

  /**
   * accepts a custom endpoints object
   */
  it('from custom endpoints', () => {
    expect(
      makeEndpoints({
        trace: 'hello',
        account: 'beautiful',
        media: 'world'
      })
    ).toMatchInlineSnapshot(`
        Object {
          "account": "beautiful",
          "media": "world",
          "trace": "hello",
        }
      `);
  });

  it('throws on invalid endpoints object', () => {
    expect(() => makeEndpoints({} as any)).toThrowErrorMatchingInlineSnapshot(
      `"The provided endpoints argument is not valid."`
    );
  });

  it('throws on invalid argument', () => {
    expect(() =>
      makeEndpoints('plap' as any)
    ).toThrowErrorMatchingInlineSnapshot(
      `"The provided endpoints argument is not valid."`
    );
  });
});

/**
 * make an authentication payload to be used by the
 * PrivateKeySecret use case
 */
describe('makeAuthPayload', () => {
  /**
   * given a private key, method will
   * generate and sign the authentication payload
   *
   * here we just test the output format, not the actual
   * content which depends on the actual time..
   */
  it('generates and signs payload', () => {
    const key = new sig.SigningPrivateKey({ pemPrivateKey });
    const payload = makeAuthPayload(key);
    const parsedPayload = JSON.parse(utils.b64StringToString(payload));
    expect(parsedPayload).toEqual({
      signature: expect.any(String),
      message: expect.any(String),
      public_key: expect.any(String)
    });
    // verify signature
    const pubKey = new sig.SigningPublicKey({ pemPublicKey });
    expect(pubKey.verify(utils.signatureFromJson(parsedPayload))).toBe(true);
  });
});

/**
 * Extract objects from data / assign objects to data.
 */
describe('extractObjects / assignObjects', () => {
  const nestedObject = {
    value: {
      str: 'hello',
      arr: ['ab', 1, 3, nodeJsFileBlob, { f: nodeJsFilePath }],
      obj: {
        f: nodeJsFileBlob,
        g: true
      },
      f: browserFile
    },
    expected: new Map([
      ['arr[3]', nodeJsFileBlob],
      ['arr[4].f', nodeJsFilePath],
      ['obj.f', nodeJsFileBlob],
      ['f', browserFile]
    ])
  };

  const array = {
    value: ['toto', nodeJsFileBlob, true, nodeJsFilePath],
    expected: new Map([['[1]', nodeJsFileBlob], ['[3]', nodeJsFilePath]])
  };

  const noFile = {
    value: { hello: 'world', true: false },
    expected: new Map([])
  };

  const undefinedObject = {
    value: undefined,
    expected: new Map([])
  };

  const nullObject = {
    value: null,
    expected: new Map([])
  };

  /**
   * Test that the FileWrapper objects are extracted correctly.
   */
  it.each([
    ['nested object', nestedObject],
    ['array', array],
    ['object with no file', noFile],
    ['undefined', undefinedObject],
    ['null', nullObject]
  ])('extract file wrappers from %s', (_name, testObject) => {
    const { idToObjectMap, pathToIdMap } = extractFileWrappers(
      testObject.value
    );
    const actual = new Map(
      Array.from(pathToIdMap.entries()).map(([path, id]) => [
        path,
        idToObjectMap.get(id)
      ])
    );
    expect(actual).toEqual(testObject.expected);
  });

  /**
   * Test a roundtrip:
   * data
   *  |> extractFileWrappers
   *  |> change FileWrapper to FileRecord
   *  |> assignObjects (FileWrapper => FileRecord)
   *  |> extractFileRecords
   *  |> assignObjects (FileRecord => FileWrapper)
   * should give back the same data!
   */
  it('roundtrip file wrappers => file records and back', () => {
    const {
      idToObjectMap: idToFileWrapperMap,
      pathToIdMap
    } = extractFileWrappers(nestedObject.value);

    const idToFileRecordMap = new Map(
      Array.from(idToFileWrapperMap.keys()).map(
        id =>
          <[string, FileRecord]>[
            id,
            FileRecord.fromObject({
              digest: id,
              mimetype: 'text/plain',
              name: 'data.txt',
              size: 123
            })
          ]
      )
    );

    type TData = typeof nestedObject.value;
    const newData = assignObjects<FileWrapper, FileRecord, TData>(
      nestedObject.value,
      pathToIdMap,
      idToFileRecordMap
    );
    expect(FileRecord.isFileRecord(newData.f)).toBe(true);
    expect(FileRecord.isFileRecord(newData.obj.f)).toBe(true);
    expect(FileRecord.isFileRecord(newData.arr[3])).toBe(true);
    // @ts-ignore
    expect(FileRecord.isFileRecord(newData.arr[4].f)).toBe(true);

    const {
      idToObjectMap: idToFileRecordMap2,
      pathToIdMap: pathToIdMap2
    } = extractFileRecords(newData);
    expect(idToFileRecordMap2).toEqual(idToFileRecordMap);
    expect(pathToIdMap2).toEqual(pathToIdMap);

    type TNewData = typeof newData;
    const sameData = assignObjects<FileRecord, FileWrapper, TNewData>(
      newData,
      pathToIdMap,
      idToFileWrapperMap
    );
    expect(sameData).toEqual(nestedObject.value);
  });

  /**
   * Test the plain assign object method.
   */
  it('assignObjects', () => {
    const initialObject = {
      a: {
        b: {
          c: {},
          d: {}
        },
        e: {}
      },
      f: [null, null, null]
    };
    const idToObjectMap = new Map([['id1', 'hello'], ['id2', 'world']]);
    const pathToIdMap = new Map([
      ['a.b.c', 'id1'],
      ['a.e', 'id2'],
      ['f[2]', 'id1']
    ]);

    const expected = {
      a: {
        b: {
          c: 'hello',
          d: {}
        },
        e: 'world'
      },
      f: [null, null, 'hello']
    };

    expect(assignObjects(initialObject, pathToIdMap, idToObjectMap)).toEqual(
      expected
    );
    expect(initialObject).not.toEqual(expected);
  });
});
