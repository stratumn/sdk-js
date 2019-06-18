import { sig } from '@stratumn/js-crypto';
import fetch, { RequestInit } from 'node-fetch';
import { URL } from 'url';
import merge from 'lodash.merge';
import qs, { ParsedUrlQueryInput } from 'querystring';
import bcrypt from 'bcryptjs';
import { GraphQLClient } from 'graphql-request';
import { Variables } from 'graphql-request/dist/src/types';
import {
  Endpoints,
  Service,
  Secret,
  isCredentialSecret,
  isPrivateKeySecret,
  isProtectedKeySecret,
  EnvTag
} from './types';
import { extractApiUrls, makeAuthPayload } from './helpers';

interface LoginResponse {
  token: string;
}

interface SaltResponse {
  salt: string;
}

interface FetchOptions {
  authToken?: string;
  skipAuth?: boolean;
}

const defaultFetchOptions: FetchOptions = {
  skipAuth: false
};

interface Config {
  endpoints?: EnvTag | Endpoints;
  secret: Secret;
}

export class Client {
  private endpoints: Endpoints;
  private secret: Secret;
  private token?: string;

  constructor(cfg: Config) {
    this.endpoints = extractApiUrls(cfg.endpoints);
    this.secret = cfg.secret;
  }

  private getAuthorizationHeader(token?: string) {
    const theToken = token || this.token;
    return theToken ? `Bearer ${theToken}` : '';
  }

  private setToken(token: string) {
    this.token = token;
    return this;
  }

  private async fetch<T = any>(
    service: Service,
    route: string,
    req?: RequestInit,
    opts?: FetchOptions
  ): Promise<T> {
    const { authToken, skipAuth } = opts || defaultFetchOptions;
    if (!this.token && !skipAuth) {
      await this.login();
    }
    const url = new URL(route, this.endpoints[service]).toString();
    const baseReq: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.getAuthorizationHeader(authToken)
      }
    };

    const rsp = await fetch(url, merge(baseReq, req));

    const { status } = rsp;

    if (status >= 500) {
      console.error(await rsp.text());
      throw new Error('Something went wrong');
    }
    let body;
    if (status !== 204) {
      body = await rsp.json();
    }

    if (body.errors) {
      console.error(body.errors);
      throw new Error('An error occurred');
    }
    8;
    return body;
  }

  public post<T = any>(
    service: Service,
    route: string,
    body: any,
    opts?: FetchOptions
  ) {
    const req: RequestInit = {
      method: 'POST',
      body: JSON.stringify(body)
    };
    return this.fetch<T>(service, route, req, opts);
  }

  public get<T = any>(
    service: Service,
    route: string,
    params?: ParsedUrlQueryInput,
    opts?: FetchOptions
  ) {
    const routeWithQs = `${route}?${qs.stringify(params)}`;
    return this.fetch<T>(service, routeWithQs, undefined, opts);
  }

  public async graphql<T>(query: string, variables?: Variables) {
    if (!this.token) {
      await this.login();
    }
    const gqlUrl = new URL('graphql', this.endpoints.trace).toString();
    return new GraphQLClient(gqlUrl)
      .setHeader('Authorization', this.getAuthorizationHeader())
      .request<T>(query, variables);
  }

  private async loginWithSigningPrivateKey(key: string) {
    const signingPrivateKey = new sig.SigningPrivateKey({ pemPrivateKey: key });
    const signedToken = makeAuthPayload(signingPrivateKey);
    const { token } = await this.get<LoginResponse>(
      'account',
      'login',
      undefined,
      { skipAuth: true, authToken: signedToken }
    );
    this.setToken(token);
  }

  private async loginWithCredentials(email: string, password: string) {
    const { salt } = await this.get<SaltResponse>(
      'account',
      'salt',
      {
        email
      },
      { skipAuth: true }
    );
    const passwordHash = await bcrypt.hash(password, salt);
    const rsp = await this.post<LoginResponse>(
      'account',
      'login',
      {
        email,
        passwordHash
      },
      { skipAuth: true }
    );
    this.setToken(rsp.token);
  }

  private async login() {
    if (isCredentialSecret(this.secret)) {
      const { email, password } = this.secret;
      await this.loginWithCredentials(email, password);
    } else if (isPrivateKeySecret(this.secret)) {
      const { privateKey } = this.secret;
      await this.loginWithSigningPrivateKey(privateKey);
    } else if (isProtectedKeySecret(this.secret)) {
      throw new Error(
        'Authentication via password protected key is not handled.'
      );
    } else {
      throw new Error('The provided secret does not have the right format');
    }
  }
}
