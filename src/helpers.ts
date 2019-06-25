import { EnvTag, Endpoints, Service } from './types';
import { sig, utils } from '@stratumn/js-crypto';

/**
 * An array of Stratumn services
 */
const SERVICES: Service[] = ['account', 'media', 'trace'];

/**
 * An array of Stratumn environments
 */
const ENVS: EnvTag[] = ['staging', 'demo', 'release'];

/**
 * Generates the api url of the service for a given environment
 *
 * @param env the environment tag
 * @param service the service name
 * @return the api url of the service
 */
const makeApiUrl = (env: EnvTag, service: Service) => {
  if (env === 'release') return `https://${service}-api.stratumn.com`;
  return `https://${service}-api.${env}.stratumn.rocks`;
};

/**
 * Generates the endpoints object for a given tag.
 *
 * @param endpoints (optional) the environment tag or custom endpoints object
 * @return the endpoints object
 */
export const extractApiUrls = (endpoints?: EnvTag | Endpoints) => {
  if (typeof endpoints === 'object') {
    const { account, media, trace } = endpoints;
    if (!account || !trace || !media) {
      throw new Error('The provided endpoints argument is not valid.');
    }
    return endpoints;
  }
  let env: EnvTag = 'release';
  if (typeof endpoints === 'string') {
    if (!ENVS.includes(endpoints as EnvTag)) {
      throw new Error(
        `The provided tag is invalid. Must be one of ${ENVS.join(' | ')}`
      );
    }
    env = endpoints;
  }
  const [account, media, trace] = SERVICES.map(svc => makeApiUrl(env, svc));
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
