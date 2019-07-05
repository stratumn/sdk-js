import to from 'await-to-js';
import fetch, { RequestInfo } from 'node-fetch';
import bcrypt from 'bcryptjs';
import { mocked } from 'ts-jest/utils';
import { Client } from './client';
import { fixtures } from './fixtures';
import { FetchOptions } from './types';
import graphqlRequest from './graphqlRequest';

const fetchError = new Error('fetch error');
const salt = bcrypt.genSaltSync();
const email = 'alice';
const password = 'secret';
const token = 'valid';
const passwordHash = bcrypt.hashSync(password, salt);
const { pemPrivateKey } = fixtures.signingKey;

jest.mock('node-fetch');
const mockFetch = mocked(fetch);

jest.mock('./graphqlRequest');
const mockGraphqlRequest = mocked(graphqlRequest);

/**
 * Client tests
 */
describe('Client', () => {
  let client: Client;
  beforeEach(() => {
    mockFetch.mockReset();
    mockGraphqlRequest.mockReset();
    client = new Client({ secret: { privateKey: pemPrivateKey } });
  });
  /**
   * Login mechanism is triggered whenever a request is made.
   */
  describe('login', () => {
    beforeEach(() => {
      mockFetch.mockImplementation(async (url: RequestInfo) => {
        if (typeof url === 'string' && url.search('/salt?') > 0) {
          return { ok: true, status: 200, json: async () => ({ salt }) } as any;
        }
        throw fetchError;
      });
    });

    /**
     * The GET /salt + POST /login routes are called when
     * using CredentialSecret.
     */
    it('via credentials', async () => {
      const client = new Client({
        secret: { email, password }
      });
      const [err] = await to(client.get('account', 'route'));
      expect(err).toEqual(fetchError);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        'https://account-api.stratumn.com/salt?email=alice',
        { headers: { Authorization: '', 'content-type': 'application/json' } }
      );
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        'https://account-api.stratumn.com/login',
        {
          headers: { Authorization: '', 'content-type': 'application/json' },
          body: JSON.stringify({ email, passwordHash }),
          method: 'POST'
        }
      );
    });

    /**
     * The GET /login route is called when using PrivateKeySecret.
     */
    it('via signing private key', async () => {
      const client = new Client({
        secret: { privateKey: pemPrivateKey }
      });
      const [err] = await to(client.get('account', 'route'));
      expect(err).toEqual(fetchError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        'https://account-api.stratumn.com/login',
        {
          headers: {
            Authorization: expect.stringMatching(/Bearer .*/),
            'content-type': 'application/json'
          }
        }
      );
    });

    /**
     * The ProtectedKeySecret is not handled yet.
     */
    it('throws when password protected key', async () => {
      const client = new Client({
        secret: { publicKey: 'pub', password }
      });
      const [err] = await to(client.get('account', 'route'));
      expect(err!.message).toMatchInlineSnapshot(
        `"Authentication via password protected key is not handled"`
      );
    });

    /**
     * Throws when the format of the secret is unknown.
     */
    it('throws when secret format is incorrect', async () => {
      const client = new Client({
        secret: {} as any
      });
      const [err] = await to(client.get('account', 'route'));
      expect(err!.message).toMatchInlineSnapshot(
        `"The provided secret does not have the right format"`
      );
    });

    /**
     * The login mechanism is always called first when doing a
     * get, post or graphql query.
     */
    describe('always login first', () => {
      it.each([
        ['method get', () => client.get('account', 'route')],
        ['method post', () => client.post('account', 'route', {})],
        ['method graphql', () => client.graphql('query { me { name } }')]
      ])('%s', async (_name, func) => {
        await to(func());
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(mockFetch).toHaveBeenCalledWith(
          'https://account-api.stratumn.com/login',
          expect.any(Object)
        );
      });
    });

    /**
     * Do not login twice in a row
     */
    describe('do not login the second time', () => {
      beforeEach(() => {
        mockFetch.mockImplementation(async (url: RequestInfo) => {
          if (typeof url === 'string' && url.search('/salt?') > 0) {
            return {
              ok: true,
              status: 200,
              json: async () => ({ salt })
            } as any;
          }
          if (typeof url === 'string' && url.search('/login') > 0) {
            return {
              ok: true,
              status: 200,
              json: async () => ({ token })
            } as any;
          }
          throw fetchError;
        });
      });

      it.each([
        ['method get', () => client.get('account', 'route')],
        ['method post', () => client.post('account', 'route', {})]
      ])('%s', async (_name, func) => {
        // call the first time
        await to(func());
        // clear the mock
        mockFetch.mockClear();
        // call the second time
        await to(func());
        // there should be only one call to the requested url
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(mockFetch).toHaveBeenCalledWith(
          'https://account-api.stratumn.com/route',
          expect.any(Object)
        );
        expect(mockFetch.mock.calls[0][1]).toMatchObject({
          headers: {
            Authorization: 'Bearer valid'
          }
        });
      });

      it('method graphql', async () => {
        // call the first time
        await to(client.graphql('query { me { name } }'));
        // clear the mock
        mockGraphqlRequest.mockClear();
        // call the second time
        await to(client.graphql('query { me { name } }'));
        // there should be only one call to the requested url
        expect(mockGraphqlRequest).toHaveBeenCalledTimes(1);
        expect(mockGraphqlRequest).toHaveBeenCalledWith(
          'https://trace-api.stratumn.com/graphql',
          'Bearer valid',
          'query { me { name } }',
          undefined
        );
      });
    });

    describe('concurrency', () => {
      /**
       * Here we test how the client behaves under concurrent execution.
       * Since the client maintain a state for the token, there is a risk
       * of concurrent login / writing of the token. This can happen at
       * two moments: the first time we login (fresh after the sdk is instanciated)
       * and when the token expires and receives 401s.
       *
       * The below test validates that in both cases there are not multiple
       * concurrent login request done in parallel. The scenario is the following (in order):
       * - sdk receives graphql request 1
       * - sdk receives graphql request 2
       * - sdk receives post request 1
       * - sdk calls fetch for login (only once)
       * - sdk calls graphqlRequest 1 (success)
       * - sdk calls graphqlRequest 2 (success)
       * - sdk calls fetch for post request 1 (success)
       * At this point there has been 2 calls to fetch and the token expires
       * so the sdk will receive 401s next:
       * - sdk receives get request 1
       * - sdk receives get request 2
       * - sdk calls fetch for get request 1 (fails with 401)
       * - sdk calls fetch for get request 2 (fails with 401)
       * - sdk calls fetch for login (only once)
       * - sdk calls fetch for get request 1 (retry once, success)
       * - sdk calls fetch for get request 2 (retry once, success)
       */
      beforeEach(() => {
        let nthCall = 0;
        mockFetch.mockImplementation(async (url: RequestInfo) => {
          nthCall += 1;
          if (typeof url === 'string' && url.search('/salt?') > 0) {
            return { status: 200, json: async () => ({ salt }) } as any;
          }
          if (typeof url === 'string' && url.search('/login') > 0) {
            return { status: 200, json: async () => ({ token }) } as any;
          }
          // the 3rd and 4th call to fetch returns 401
          if (nthCall === 3 || nthCall === 4) {
            return { status: 401 } as any;
          }
          // otherwise success
          return { status: 200, json: async () => ({}) } as any;
        });
        mockGraphqlRequest.mockResolvedValue({} as any);
      });

      it('login once only on multiple concurrent calls to login', async () => {
        // start by making 2 graphql and 1 post requests
        await Promise.all([
          client.graphql('{ me }'),
          client.graphql('{ info }'),
          client.post('account', 'route', {})
        ]);

        // graphql should have been called twice
        expect(mockGraphqlRequest).toHaveBeenCalledTimes(2);

        // fetch should have been called twice: 1 login and 1 get
        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(mockFetch.mock.calls.map(([url]) => url)).toEqual([
          'https://account-api.stratumn.com/login',
          'https://account-api.stratumn.com/route'
        ]);

        // clear the mock to start count from scratch
        mockFetch.mockClear();

        // then make 2 more get requests which should fail and retry
        await Promise.all([
          client.get('trace', 'route1'),
          client.get('trace', 'route2')
        ]);

        // fetch should have been called 5 times:
        // - 2 requests that returned 401
        // - 1 login
        // - 2 retry requests
        expect(mockFetch).toHaveBeenCalledTimes(5);
        expect(mockFetch.mock.calls.map(([url]) => url)).toEqual([
          'https://trace-api.stratumn.com/route1',
          'https://trace-api.stratumn.com/route2',
          'https://account-api.stratumn.com/login',
          'https://trace-api.stratumn.com/route1',
          'https://trace-api.stratumn.com/route2'
        ]);
      });
    });
  });

  /**
   * Fetch options to control skipping authentication
   * and the auth token to use
   */
  describe('fetch options', () => {
    const fetchOptionsWithBoth: FetchOptions = {
      skipAuth: true,
      authToken: 'of the token'
    };

    const fetchOptionsWithToken: FetchOptions = {
      authToken: 'of the token'
    };

    const fetchOptionsWithSkip: FetchOptions = {
      skipAuth: true
    };

    beforeEach(() => {
      mockFetch.mockRejectedValueOnce(fetchError);
    });

    /**
     * Both get and post methods can skip auth and provide auth token
     */
    it.each([
      [
        'method get',
        () => client.get('account', 'route', undefined, fetchOptionsWithToken),
        'Bearer of the token'
      ],
      [
        'method post',
        () => client.post('account', 'route', {}, fetchOptionsWithToken),
        'Bearer of the token'
      ],
      [
        'method get',
        () => client.get('account', 'route', undefined, fetchOptionsWithSkip),
        ''
      ],
      [
        'method post',
        () => client.post('account', 'route', {}, fetchOptionsWithSkip),
        ''
      ],
      [
        'method get',
        () => client.get('account', 'route', undefined, fetchOptionsWithBoth),
        'Bearer of the token'
      ],
      [
        'method post',
        () => client.post('account', 'route', {}, fetchOptionsWithBoth),
        'Bearer of the token'
      ]
    ])('%s', async (_name, func, expected) => {
      await to(func());
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch.mock.calls[0][1]).toMatchObject({
        headers: {
          Authorization: expected
        }
      });
    });
  });

  /**
   * Retry logic when response status is 401
   */
  describe('retry', () => {
    const saltRsp: any = {
      ok: true,
      status: 200,
      json: async () => ({ salt })
    };
    const unauthenticatedRsp: any = {
      ok: false,
      status: 401,
      json: async () => ({ message: 'not authenticated' })
    };

    /**
     * When using fetch
     */
    describe('fetch', () => {
      beforeEach(() => {
        // first attempt
        mockFetch.mockResolvedValueOnce(saltRsp);
        mockFetch.mockResolvedValueOnce(unauthenticatedRsp);
        // second attempt
        mockFetch.mockResolvedValueOnce(saltRsp);
        mockFetch.mockResolvedValueOnce(unauthenticatedRsp);
        // third attempt
        mockFetch.mockResolvedValueOnce(saltRsp);
        mockFetch.mockResolvedValueOnce(unauthenticatedRsp);
      });

      it.each([
        ['retries once by default', undefined, 4],
        ['retries twice', { retry: 2 }, 6],
        ['no retry', { retry: 0 }, 2]
      ])('%s', async (_name, opts, expected) => {
        await to(client.get('trace', 'route', undefined, opts));
        expect(mockFetch).toHaveBeenCalledTimes(expected);
        for (let i = 1; i <= expected; i += 1) {
          const route =
            i % 2
              ? 'https://account-api.stratumn.com/login'
              : 'https://trace-api.stratumn.com/route';
          expect(mockFetch).toHaveBeenNthCalledWith(
            i,
            route,
            expect.any(Object)
          );
        }
      });
    });

    /**
     * When using graphql
     */
    describe('graphql', () => {
      beforeEach(() => {
        // first attempt
        mockFetch.mockResolvedValueOnce(saltRsp);
        mockGraphqlRequest.mockRejectedValueOnce({
          response: { ok: false, status: 401 }
        });
        // second attempt
        mockFetch.mockResolvedValueOnce(saltRsp);
        mockGraphqlRequest.mockRejectedValueOnce({
          response: { ok: false, status: 401 }
        });
        // third attempt
        mockFetch.mockResolvedValueOnce(saltRsp);
        mockGraphqlRequest.mockRejectedValueOnce({
          response: { ok: false, status: 401 }
        });
      });

      it.each([
        ['retries once by default', undefined, 4],
        ['retries twice', { retry: 2 }, 6],
        ['no retry', { retry: 0 }, 2]
      ])('%s', async (_name, opts, expected) => {
        await to(client.graphql('query { me { name } }', undefined, opts));
        expect(mockFetch).toHaveBeenCalledTimes(expected / 2);
        expect(mockGraphqlRequest).toHaveBeenCalledTimes(expected / 2);
        for (let i = 1; i <= expected / 2; i += 1) {
          expect(mockFetch).toHaveBeenNthCalledWith(
            i,
            'https://account-api.stratumn.com/login',
            expect.any(Object)
          );
          expect(mockGraphqlRequest).toHaveBeenNthCalledWith(
            i,
            'https://trace-api.stratumn.com/graphql',
            expect.any(String),
            expect.any(String),
            undefined
          );
        }
      });
    });
  });

  describe('uploadFiles', () => {
    const { nodeJsFileBlob, nodeJsFilePath } = fixtures.FileWrappers;

    beforeEach(() => {
      mockFetch.mockImplementation(async (url: RequestInfo) => {
        if (typeof url === 'string' && url.search('/salt?') > 0) {
          return { ok: true, status: 200, json: async () => ({ salt }) } as any;
        }
        if (typeof url === 'string' && url.search('/login') > 0) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ token })
          } as any;
        }
        return {
          ok: true,
          status: 200,
          json: async () => [nodeJsFileBlob, nodeJsFilePath]
        };
      });
    });

    it('does not POST when files array is empty', async () => {
      expect(await client.uploadFiles([])).toEqual([]);
      expect(mockFetch).toHaveBeenCalledTimes(0);
    });

    it('POST files to media', async () => {
      const rsp = await client.uploadFiles([nodeJsFileBlob, nodeJsFilePath]);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        'https://media-api.stratumn.com/files',
        {
          method: 'POST',
          headers: {
            Authorization: expect.stringMatching(/Bearer .*/),
            'content-type': expect.stringContaining(
              'multipart/form-data; boundary='
            )
          },
          body: expect.any(Object)
        }
      );
      expect(rsp).toEqual([nodeJsFileBlob, nodeJsFilePath]);
    });
  });

  describe('downloadFile', () => {
    const downloadUrl = 'download url';
    const blob = Buffer.from('blob');
    const { fileRecord } = fixtures.FileRecords;
    beforeEach(() => {
      mockFetch.mockImplementation(async (url: RequestInfo) => {
        if (typeof url === 'string' && url.search('/salt?') > 0) {
          return { ok: true, status: 200, json: async () => ({ salt }) } as any;
        }
        if (typeof url === 'string' && url.search('/login') > 0) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ token })
          } as any;
        }
        if (typeof url === 'string' && url.search('/info') > 0) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ download_url: downloadUrl })
          } as any;
        }
        return {
          ok: true,
          status: 200,
          blob: async () => blob
        };
      });
    });

    it('returns the blob data', async () => {
      expect(await client.downloadFile(fileRecord)).toEqual(blob);
      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        'https://media-api.stratumn.com/files/abc123/info',
        {
          headers: {
            Authorization: 'Bearer valid',
            'content-type': 'application/json'
          }
        }
      );
      expect(mockFetch).toHaveBeenNthCalledWith(3, 'download url');
    });
  });
});
