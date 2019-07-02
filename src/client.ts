import to from 'await-to-js';
import { sig } from '@stratumn/js-crypto';
import fetch, { RequestInit } from 'node-fetch';
import { URL } from 'url';
import merge from 'lodash.merge';
import qs, { ParsedUrlQueryInput } from 'querystring';
import bcrypt from 'bcryptjs';
import { Variables } from 'graphql-request/dist/src/types';
import graphqlRequest from './graphqlRequest';
import {
  Endpoints,
  Service,
  Secret,
  isCredentialSecret,
  isPrivateKeySecret,
  isProtectedKeySecret,
  ClientOptions,
  FetchOptions,
  LoginResponse,
  SaltResponse,
  GraphQLOptions
} from './types';
import { makeEndpoints, makeAuthPayload } from './helpers';

/**
 * The default fetch options:
 * - do not skip authentication
 * - retry once
 */
const defaultFetchOptions: FetchOptions = {
  skipAuth: false,
  retry: 1
};

/**
 * The default GraphQL options:
 * - retry once
 */
const defaultGraphQLOptions: FetchOptions = {
  retry: 1
};

/**
 * A wrapper client to handle communication
 * with account, trace and media via REST and GraphQL
 *
 * The Client will handle (re-)authentication if
 * a token is not present yet or expired.
 *
 * The Client exposes 3 methods:
 * - get
 * - post
 * - graphql
 */
export class Client {
  /**
   * The endpoint urls for all the services
   */
  private endpoints: Endpoints;
  /**
   * The secret used to authenticate
   */
  private secret: Secret;
  /**
   * The token received from account service after authentication
   */
  private token?: string;

  /**
   * Constructs a new instance of the Client
   * @param opts the client options
   */
  constructor(opts: ClientOptions) {
    this.endpoints = makeEndpoints(opts.endpoints);
    this.secret = opts.secret;
  }

  /*********************************************************
   *                   private methods                     *
   *********************************************************/

  /**
   * Compute the bearer Authorization header of format "Bearer my_token".
   * If the token is undefined, the return header is an empty string "".
   *
   * @param token optional token to be used
   */
  private makeAuthorizationHeader(token?: string) {
    return token ? `Bearer ${token}` : '';
  }

  /**
   * Retrieves an authentication token based on the following waterfall:
   * - if opts.authToken is set, use it to compute the auth header
   * - if opts.skipAuth is true, return empty auth header
   * - otherwise login and use the retrieved token to compute the auth header
   *
   * @param opts optional options
   * @param opts.authToken optional token to be used
   * @param opts.skipAuth optional flag to bypass authentication
   */
  private async getAuthorizationHeader(opts?: {
    authToken?: string;
    skipAuth?: boolean;
  }) {
    if (opts) {
      const { skipAuth, authToken } = opts;
      if (authToken) return this.makeAuthorizationHeader(authToken);
      if (skipAuth) return this.makeAuthorizationHeader();
    }
    if (!this.token) {
      await this.login();
    }

    return this.makeAuthorizationHeader(this.token);
  }

  /**
   * To set a new token
   * @param token the new token
   */
  private setToken(token: string) {
    this.token = token;
  }

  /**
   * To clear the existing token
   */
  private clearToken() {
    this.token = undefined;
  }

  /**
   * Utility method to fetch a ressource on a target service via REST.
   *
   * @param service the service to target (account|trace|media)
   * @param route the route on the target service
   * @param req the content of the request
   * @param opts additional fetch options
   * @returns the response body object
   */
  private async fetch<T = any>(
    service: Service,
    route: string,
    req?: RequestInit,
    opts?: FetchOptions
  ): Promise<T> {
    const { authToken, skipAuth, retry } = opts || defaultFetchOptions;

    // construct the target URL from the service + route
    const url = new URL(route, this.endpoints[service]).toString();

    // start building the fetch request
    // - always use application/json
    // - set the Authorization header
    const baseReq: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        Authorization: await this.getAuthorizationHeader({
          authToken,
          skipAuth
        })
      }
    };

    // merge the first request part with the provided request
    // which contains the body, method etc...
    // then call fetch
    // TODO: catch and handle errors
    const rsp = await fetch(url, merge(baseReq, req));

    // get the status to switch among various cases
    const { status } = rsp;

    // TODO: have a proper status error code handling

    // if 401 and retry > 0 then we can retry
    if (status === 401 && retry) {
      // unauthenticated request might be because token expired
      // clear token and retry
      this.clearToken();
      return this.fetch(service, route, req, { ...opts, retry: retry - 1 });
    }

    // if 5xx then log the error and throw
    if (status >= 500) {
      console.error(await rsp.text());
      throw new Error('Something went wrong');
    }

    let body;
    // 204 means there is no body
    if (status !== 204) {
      body = await rsp.json();
    }

    // if the body contains errors, log them and throw
    if (body.errors) {
      console.error(body.errors);
      throw new Error('An error occurred');
    }

    // finally return the body
    return body;
  }

  /**
   * Authenticate using a signed message via the GET /login route.
   *
   * @param key the signing private key in clear text used to log in
   */
  private async loginWithSigningPrivateKey(key: string) {
    // create a SigningPrivateKey object with the one provided
    const signingPrivateKey = new sig.SigningPrivateKey({ pemPrivateKey: key });

    // generate a signed token that will act as an authentication payload
    const signedToken = makeAuthPayload(signingPrivateKey);

    // call GET /login using the signed token as the auth token
    // to bypass authentication
    const { token } = await this.get<LoginResponse>(
      'account',
      'login',
      undefined,
      { authToken: signedToken }
    );

    // finally set the new token
    this.setToken(token);
  }

  /**
   * Authenticates using a user's credentials via the POST /login route.
   *
   * @param email the email of the user
   * @param password the password of the user
   */
  private async loginWithCredentials(email: string, password: string) {
    // get the user salt first
    // use skipAuth = true to bypass authentication
    // GET /salt is a public route!
    const { salt } = await this.get<SaltResponse>(
      'account',
      'salt',
      {
        email
      },
      { skipAuth: true }
    );

    // hash the password with the salt
    const passwordHash = await bcrypt.hash(password, salt);

    // post the login payload
    // use skipAuth = true to bypass authentication
    // POST /login is a public route!
    const rsp = await this.post<LoginResponse>(
      'account',
      'login',
      {
        email,
        passwordHash
      },
      { skipAuth: true }
    );

    // finally set the new token
    this.setToken(rsp.token);
  }

  /**
   * Authenticates using a valid secret.
   * Supported secret types are:
   * - CredentialSecret -> via email+password
   * - PrivateKeySecret -> via signed message
   */
  private async login() {
    if (isCredentialSecret(this.secret)) {
      // the CredentialSecret case
      const { email, password } = this.secret;
      await this.loginWithCredentials(email, password);
    } else if (isPrivateKeySecret(this.secret)) {
      // the PrivateKeySecret case
      const { privateKey } = this.secret;
      await this.loginWithSigningPrivateKey(privateKey);
    } else if (isProtectedKeySecret(this.secret)) {
      // the ProtectedKeySecret case
      // not handled yet
      throw new Error(
        'Authentication via password protected key is not handled'
      );
    } else {
      // Unknown case
      throw new Error('The provided secret does not have the right format');
    }
  }

  /*********************************************************
   *                   public methods                     *
   *********************************************************/

  /**
   * Executes a POST query on a target service.
   *
   * @param service the service to target (account|trace|media)
   * @param route the route on the target service
   * @param body the POST body object
   * @param opts additional fetch options
   * @returns the response body object
   */
  public post<T = any>(
    service: Service,
    route: string,
    body: any,
    opts?: FetchOptions
  ) {
    // creates the request object with method POST
    // and a stringified body
    const req: RequestInit = {
      method: 'POST',
      body: JSON.stringify(body)
    };

    // delegate to fetch wrapper
    return this.fetch<T>(service, route, req, opts);
  }

  /**
   * Executes a GET query on a target service.
   *
   * @param service the service to target (account|trace|media)
   * @param route the route on the target service
   * @param params the query parameters
   * @param opts additional fetch options
   * @returns the response body object
   */
  public get<T = any>(
    service: Service,
    route: string,
    params?: ParsedUrlQueryInput,
    opts?: FetchOptions
  ) {
    // compile the route with query string params if provided
    const routeWithQs = params ? `${route}?${qs.stringify(params)}` : route;

    // delegate to fetch wrapper
    return this.fetch<T>(service, routeWithQs, undefined, opts);
  }

  /**
   * Executes a GraphQL query / mutation on the Trace service.
   *
   * @param query the graphql query / mutation
   * @param variables the graphql variables
   * @param opts the graphql options
   */
  public async graphql<T = any, U = Variables>(
    query: string,
    variables?: U,
    opts?: GraphQLOptions
  ): Promise<T> {
    // compile the trace graphql endpoint url to use
    const gqlUrl = new URL('graphql', this.endpoints.trace).toString();

    // delegate the graphql request execution
    const [err, rsp] = await to(
      graphqlRequest(
        gqlUrl,
        await this.getAuthorizationHeader(),
        query,
        variables
      )
    );

    const { retry } = opts || defaultGraphQLOptions;

    // TODO: have a proper status error code handling

    // if 401 and retry > 0 then we can retry
    if (err && err.response.status === 401 && retry) {
      // unauthenticated request might be because token expired
      // clear token and retry
      this.clearToken();
      return this.graphql<T>(query, variables, { ...opts, retry: retry - 1 });
    }

    // if an error occured, log it and throw
    if (err || !rsp) {
      console.error(err);
      throw new Error('An error occurred');
    }

    // finally return the response
    return rsp;
  }
}
