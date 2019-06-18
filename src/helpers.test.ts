import { extractApiUrls } from './helpers';

describe('extractApiUrls', () => {
  it('from staging tag', () => {
    expect(extractApiUrls('staging')).toMatchInlineSnapshot(`
                  Object {
                    "account": "https://account-api.staging.stratumn.rocks",
                    "media": "https://media-api.staging.stratumn.rocks",
                    "trace": "https://trace-api.staging.stratumn.rocks",
                  }
            `);
  });

  it('from demo tag', () => {
    expect(extractApiUrls('demo')).toMatchInlineSnapshot(`
            Object {
              "account": "https://account-api.demo.stratumn.rocks",
              "media": "https://media-api.demo.stratumn.rocks",
              "trace": "https://trace-api.demo.stratumn.rocks",
            }
        `);
  });

  it('from release tag', () => {
    expect(extractApiUrls('release')).toMatchInlineSnapshot(`
            Object {
              "account": "https://account-api.stratumn.com",
              "media": "https://media-api.stratumn.com",
              "trace": "https://trace-api.stratumn.com",
            }
        `);
  });

  it('with no arg', () => {
    expect(extractApiUrls()).toMatchInlineSnapshot(`
            Object {
              "account": "https://account-api.stratumn.com",
              "media": "https://media-api.stratumn.com",
              "trace": "https://trace-api.stratumn.com",
            }
        `);
  });

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
});
