import { Endpoints } from './types';
import { sig, utils } from '@stratumn/js-crypto';

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
