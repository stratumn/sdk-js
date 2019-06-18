import { EnvTag, Endpoints } from './types';
import { sig, utils } from '@stratumn/js-crypto';

const SERVICES = ['account', 'media', 'trace'];

const makeApiUrl = (env: EnvTag, service: string) => {
  if (env === 'release') return `https://${service}-api.stratumn.com`;
  return `https://${service}-api.${env}.stratumn.rocks`;
};

export const extractApiUrls = (endpoints?: EnvTag | Endpoints) => {
  if (typeof endpoints === 'object') {
    return endpoints;
  }
  let env: EnvTag = 'release';
  if (typeof endpoints === 'string') {
    env = endpoints;
  }
  const [account, media, trace] = SERVICES.map(svc => makeApiUrl(env, svc));
  return { account, media, trace };
};

const nowInSeconds = () => Date.now() / 1000;

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
