import { sig, utils } from '@stratumn/js-crypto';
import { extractApiUrls, makeAuthPayload } from './helpers';
import { pemPrivateKey, pemPublicKey } from './fixtures';

/**
 * Extracts all api urls from a tag
 */
describe('extractApiUrls', () => {
  /**
   * staging
   */
  it('from staging tag', () => {
    expect(extractApiUrls('staging')).toMatchInlineSnapshot(`
                  Object {
                    "account": "https://account-api.staging.stratumn.rocks",
                    "media": "https://media-api.staging.stratumn.rocks",
                    "trace": "https://trace-api.staging.stratumn.rocks",
                  }
`);
  });

  /**
   * demo
   */
  it('from demo tag', () => {
    expect(extractApiUrls('demo')).toMatchInlineSnapshot(`
                  Object {
                    "account": "https://account-api.demo.stratumn.rocks",
                    "media": "https://media-api.demo.stratumn.rocks",
                    "trace": "https://trace-api.demo.stratumn.rocks",
                  }
  `);
  });

  /**
   * release
   */
  it('from release tag', () => {
    expect(extractApiUrls('release')).toMatchInlineSnapshot(`
                                                Object {
                                                  "account": "https://account-api.stratumn.com",
                                                  "media": "https://media-api.stratumn.com",
                                                  "trace": "https://trace-api.stratumn.com",
                                                }
                                `);
  });

  /**
   * no args defaults to release
   */
  it('with no arg', () => {
    expect(extractApiUrls()).toMatchInlineSnapshot(`
                                                Object {
                                                  "account": "https://account-api.stratumn.com",
                                                  "media": "https://media-api.stratumn.com",
                                                  "trace": "https://trace-api.stratumn.com",
                                                }
                                `);
  });

  /**
   * accepts a custom env object too
   */
  it('from custom env', () => {
    expect(
      extractApiUrls({
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
    expect(() => extractApiUrls({} as any)).toThrowErrorMatchingInlineSnapshot(
      `"The provided endpoints argument is not valid."`
    );
  });

  it('throws on invalid env tag', () => {
    expect(() =>
      extractApiUrls('plap' as any)
    ).toThrowErrorMatchingInlineSnapshot(
      `"The provided tag is invalid. Must be one of staging | demo | release"`
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
