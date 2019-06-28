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
  /**
   * Login mechanism is triggered whenever a request is made.
   */
  describe('login', () => {
    beforeEach(() => {
      mockFetch.mockClear();
      mockFetch.mockImplementation(async (url: RequestInfo) => {
        if (typeof url === 'string' && url.search('/salt?') > 0) {
          return { status: 200, json: async () => ({ salt }) } as any;
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
        { headers: { Authorization: '', 'Content-Type': 'application/json' } }
      );
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        'https://account-api.stratumn.com/login',
        {
          headers: { Authorization: '', 'Content-Type': 'application/json' },
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
            'Content-Type': 'application/json'
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
      let client: Client;
      beforeEach(() => {
        client = new Client({ secret: { privateKey: pemPrivateKey } });
      });

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
      let client: Client;
      beforeEach(() => {
        client = new Client({ secret: { privateKey: pemPrivateKey } });
        mockFetch.mockImplementation(async (url: RequestInfo) => {
          if (typeof url === 'string' && url.search('/salt?') > 0) {
            return { status: 200, json: async () => ({ salt }) } as any;
          }
          if (typeof url === 'string' && url.search('/login') > 0) {
            return { status: 200, json: async () => ({ token }) } as any;
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

    let client: Client;
    beforeEach(() => {
      client = new Client({ secret: { privateKey: pemPrivateKey } });
      mockFetch.mockClear();
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
    let client: Client;
    const saltRsp: any = {
      status: 200,
      json: async () => ({ salt })
    };
    const unauthenticatedRsp: any = {
      status: 401,
      json: async () => ({ message: 'not authenticated' })
    };

    /**
     * When using fetch
     */
    describe('fetch', () => {
      beforeEach(() => {
        client = new Client({ secret: { privateKey: pemPrivateKey } });
        mockFetch.mockClear();
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
        client = new Client({ secret: { privateKey: pemPrivateKey } });
        mockFetch.mockClear();
        mockGraphqlRequest.mockClear();
        // first attempt
        mockFetch.mockResolvedValueOnce(saltRsp);
        mockGraphqlRequest.mockRejectedValueOnce({ response: { status: 401 } });
        // second attempt
        mockFetch.mockResolvedValueOnce(saltRsp);
        mockGraphqlRequest.mockRejectedValueOnce({ response: { status: 401 } });
        // third attempt
        mockFetch.mockResolvedValueOnce(saltRsp);
        mockGraphqlRequest.mockRejectedValueOnce({ response: { status: 401 } });
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
});
