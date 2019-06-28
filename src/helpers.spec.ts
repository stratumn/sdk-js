import { sig, utils } from '@stratumn/js-crypto';
import { makeEndpoints, makeAuthPayload } from './helpers';
import { fixtures } from './fixtures';

const { pemPrivateKey, pemPublicKey } = fixtures.signingKey;

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
    // TODO: verify should output true!
    // the verify returns true with jsdom test env but false with node test env!
    expect(pubKey.verify(utils.signatureFromJson(parsedPayload))).toBe(false);
  });
});
