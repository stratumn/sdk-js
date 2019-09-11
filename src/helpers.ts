import { sig, utils } from '@stratumn/js-crypto';
import setInObject from 'lodash.set';
import mergeObjects from 'lodash.merge';
import { Endpoints, Transform, Identifiable } from './types';
import { FileWrapper } from './fileWrapper';
import { FileRecord } from './fileRecord';

/**
 * The release endpoints.
 */
const releaseEndpoints: Endpoints = {
  account: 'https://account-api.stratumn.com',
  trace: 'https://trace-api.stratumn.com',
  media: 'https://media-api.stratumn.com'
};

/**
 * Generates the endpoints object. If not specified, the release
 * endpoints will be used by default.
 *
 * @param endpoints (optional) the custom endpoints object
 * @return the endpoints object
 */
export const makeEndpoints = (endpoints?: Endpoints) => {
  if (!endpoints) {
    return releaseEndpoints;
  }

  const { account, media, trace } = endpoints;
  if (!account || !trace || !media) {
    throw new Error('The provided endpoints argument is not valid.');
  }
  return { account, media, trace };
};

/**
 * Helper function to get current time in seconds
 */
const nowInSeconds = () => Date.now() / 1000;

/**
 * Generates a signed token that can be used to
 * authenticate to retrieve a long lived auth token.
 *
 * @param key the signing private key
 * @returns the signed token
 */
export const makeAuthPayload = (key: sig.SigningPrivateKey) =>
  utils.stringToB64String(
    JSON.stringify(
      utils.signatureToJson(
        key.sign(
          utils.stringToBytes(
            JSON.stringify({
              iat: nowInSeconds(),
              exp: nowInSeconds() + 60 * 5
            })
          )
        )
      )
    )
  );

/**
 * The implementation of the extractObjects function below.
 *
 * @param data the data where objects should be extracted
 * @param path the current path in the data
 * @param pathToIdMap the path to id map
 * @param idToObjectMap the id to object map
 * @param predicate the predicate function used to determine
 * if object should be extracted
 * @param reviver (optional) a function to apply on the extracted object
 */
const extractObjectsImpl = <T, V extends Identifiable>(
  data: T,
  path: string,
  pathToIdMap: Map<string, string>,
  idToObjectMap: Map<string, V>,
  predicate: (x: any) => x is V,
  reviver?: (x: V) => V
) => {
  // if the predicate is true, then this data should be extracted
  if (predicate(data)) {
    // apply reviver if provided
    const newData = reviver ? reviver(data) : data;

    // add a new entry in the pathToId map
    pathToIdMap.set(path, newData.id);

    // add a new entry to the idToObject map
    idToObjectMap.set(newData.id, newData);
  } else if (Array.isArray(data)) {
    // if it is an array, iterate through each element and
    // extract objects recursively
    data.forEach((value, idx) => {
      extractObjectsImpl(
        // the new data to extract from
        value,
        // the new path is `path[idx]`
        `${path}[${idx}]`,
        pathToIdMap,
        idToObjectMap,
        predicate,
        reviver
      );
    });
  } else if (data && typeof data === 'object') {
    // if it is an object, iterate through each entry
    // and extract objects recursively
    for (const [key, value] of Object.entries(data)) {
      extractObjectsImpl(
        // the new data to extract from
        value,
        // the new path is `path.key`
        // when in the root data, path is empty
        // so use the key directly
        path === '' ? key : `${path}.${key}`,
        pathToIdMap,
        idToObjectMap,
        predicate,
        reviver
      );
    }
  }
};

/**
 * Extracts all identifiable objects in data that satisfy a predicate
 * and return two maps to easily work with them:
 * - pathToIdMap: maps all the paths where an object was found to their id
 * - idToObjectMap: maps all ids to the actual extracted objects
 *
 * @param data the data where objects should be extracted
 * @param predicate the predicate function used to determine
 * if object should be extracted
 * @param reviver (optional) a function to apply on the extracted object
 */
const extractObjects = <T, V extends Identifiable>(
  data: T,
  predicate: (x: any) => x is V,
  reviver?: (x: V) => V
) => {
  // create a new pathToId map
  const pathToIdMap = new Map<string, string>();

  // create a new idToObject map
  const idToObjectMap = new Map<string, V>();

  // call the implementation
  extractObjectsImpl(data, '', pathToIdMap, idToObjectMap, predicate, reviver);

  // return the maps
  return { pathToIdMap, idToObjectMap };
};

/**
 * Extract all file wrappers from some data.
 *
 * @param data the data containing file wrappers to extract
 */
export const extractFileWrappers = <T>(data: T) =>
  extractObjects(data, FileWrapper.isFileWrapper);

/**
 * Extract all file records from some data.
 *
 * @param data the data containing file records to extract
 */
export const extractFileRecords = <T>(data: T) =>
  extractObjects(data, FileRecord.isFileRecord, FileRecord.fromObject);

/**
 * Assign objects identified by the 2 maps (pathToId and idToObject)
 * to the right place in the data.
 *
 * @param data the data where objects should be assigned
 * @param pathToIdMap the pathToId map
 * @param idToObjectMap the idToObject map
 * @returns the transformed data
 */
export const assignObjects = <T1, T2, TData extends Object>(
  data: TData,
  pathToIdMap: Map<string, string>,
  idToObjectMap: Map<string, T2>
): Transform<T1, T2, TData> => {
  // if the map is empty just return data unchanged
  if (!pathToIdMap.size) {
    return data as any;
  }

  // create an empty object that will collect
  // all the objects described by the maps
  const res: any = {};

  // iterate through the pathToId map
  for (const [path, id] of pathToIdMap) {
    // get the corresponding object from the idTOObject map
    const value = idToObjectMap.get(id);

    // set the object at the specified path
    setInObject(res, path, value);
  }

  // finally merge data and the collection object
  // note that we are preserving data by doing so.
  return mergeObjects({}, data, res);
};
