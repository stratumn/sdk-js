import to from 'await-to-js';
import { sig } from '@stratumn/js-crypto';
import fetch, { RequestInit } from 'node-fetch';
import FormData from 'form-data';
import { URL } from 'url';
import merge from 'lodash.merge';
import qs, { ParsedUrlQueryInput } from 'querystring';
import bcrypt from 'bcryptjs';
import { Mutex } from 'async-mutex';
import { Variables, ClientError } from 'graphql-request/dist/src/types';
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
  GraphQLOptions,
  MediaRecord
} from './types';
import { makeEndpoints, makeAuthPayload } from './helpers';
import { FileWrapper } from './fileWrapper';
import HttpError from './httpError';

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
   * The mutex used to prevent concurrent login requests
   */
  private mutex: Mutex;

  /**
   * enable request and response logging
   */
  private enableDebugging?: boolean;

  /**
   * Constructs a new instance of the Client
   * @param opts the client options
   */
  constructor(opts: ClientOptions) {
    this.endpoints = makeEndpoints(opts.endpoints);
    this.secret = opts.secret;
    this.mutex = new Mutex();
    this.enableDebugging = opts.enableDebugging;
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

    await this.login();

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
        // content-type in lowercase as
        // FormData headers spell it like that.
        'content-type': 'application/json',
        Authorization: await this.getAuthorizationHeader({
          authToken,
          skipAuth
        })
      }
    };

    // merge the first request part with the provided request
    // which contains the body, method etc... then call fetch
    const rsp = await fetch(url, merge(baseReq, req));

    // extract relevant info to check if request was a success
    const { ok, status, statusText } = rsp;

    // handle errors explicitly
    if (!ok) {
      // if 401 and retry > 0 then we can retry
      if (status === 401 && retry) {
        // unauthenticated request might be because token expired
        // clear token and retry
        this.clearToken();
        return this.fetch(service, route, req, { ...opts, retry: retry - 1 });
      }

      // otherwise that's a proper error
      // extract the text body of the response
      // and try to convert it to JSON
      const [e, errTxt] = await to(rsp.text());
      let errJsn: any;
      if (!e && errTxt) {
        try {
          errJsn = JSON.parse(errTxt);
        } catch (_) {
          // do nothing if it fails, it means the body
          // is not json, we'll use the text body in this case
        }
      }

      // throw that new error
      throw new HttpError(status, statusText, errJsn || errTxt);
    }

    let body;
    // 204 means there is no body
    if (status !== 204) {
      body = await rsp.json();
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
    // acquire the mutex
    const release = await this.mutex.acquire();
    try {
      // if another concurrent execution has already
      // done the job, then release and return, nothing to do.
      if (this.token) {
        release();
        return;
      }

      // otherwise do the job...
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

      // in case no error were thrown, release here
      release();
    } catch (err) {
      // always release before rethrowing the error.
      release();
      throw err;
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

    if (this.enableDebugging) {
      console.log(
        '======================= GraphQL Request ======================='
      );
      console.log(query);
      console.log(variables);
    }

    // delegate the graphql request execution
    const [err, rsp] = await to<T, ClientError>(
      graphqlRequest<T>(
        gqlUrl,
        await this.getAuthorizationHeader(),
        query,
        variables
      )
    );

    if (this.enableDebugging) {
      console.log(
        '======================= GraphQL Response ======================='
      );
      console.log(rsp);
      if (err) console.log(err);
    }

    const { retry } = opts || defaultGraphQLOptions;

    // handle errors explicitly
    if (err) {
      // extract the status from the error response
      const { status } = err.response;

      // if 401 and retry > 0 then we can retry
      if (status === 401 && retry) {
        // unauthenticated request might be because token expired
        // clear token and retry
        this.clearToken();
        return this.graphql<T>(query, variables, { ...opts, retry: retry - 1 });
      }

      // otherwise rethrow
      throw err;
    }

    // if the response is empty, throw.
    if (!rsp) {
      throw new Error('The graphql response is empty.');
    }

    // finally return the response
    return rsp;
  }

  /**
   * Uploads an array of files to media-api.
   *
   * @param files the file wrappers to upload
   * @return the array of corresponding media records
   */
  public async uploadFiles(files: FileWrapper[]) {
    // when no files are provided simply return an empty array
    if (!files.length) {
      return <MediaRecord[]>[];
    }

    // create the FormData that will collect all files
    const formData = new FormData();

    // iterate through files and append to form data
    for (const file of files) {
      // retrieve the info to get the file name
      const info = await file.info();

      // append file (always encrypted)
      formData.append(info.name, await file.encryptedData(), {
        // always pass the filename so that multer (media-api)
        // knows it is a file and not a blob of data
        filename: info.name
      });
    }

    // the base request that will be used to POST to media-api
    const req: RequestInit = {
      method: 'POST',
      headers: {
        // we must override the headers using the one from FormData
        // see: https://github.com/form-data/form-data#axios
        ...formData.getHeaders()
      },
      body: formData
    };

    // note that we use this.fetch directly and not this.post
    // as we do not what the body to be stringified and we
    // want to override the headers (see above)
    return this.fetch<MediaRecord[]>('media', '/files', req);
  }

  /**
   * Downloads a file corresponding to a media record.
   *
   * @param file the file record to download
   * @return the file data (Buffer)
   */
  public async downloadFile(file: MediaRecord) {
    // GET the file info from digest
    const { download_url } = await this.get(
      'media',
      `/files/${file.digest}/info`
    );

    // use download_url to fetch the file data from storage
    const rsp = await fetch(download_url);

    // extract relevant info to check if request was a success
    const { ok, status, statusText } = rsp;

    // handle errors explicitly
    if (!ok) {
      // otherwise that's a proper error
      // extract the text body of the response
      // and try to convert it to JSON
      const [e, errTxt] = await to(rsp.text());
      let errJsn: any;
      if (!e && errTxt) {
        try {
          errJsn = JSON.parse(errTxt);
        } catch (_) {
          // do nothing if it fails, it means the body
          // is not json, we'll use the text body in this case
        }
      }

      // throw that new error
      throw new HttpError(status, statusText, errJsn || errTxt);
    }

    // return the data as buffer
    return rsp.buffer();
  }
}
