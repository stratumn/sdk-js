/**
 * The Stratumn service
 */
export type Service = 'trace' | 'account' | 'media';

/**
 * The endpoints interface to describe the api urls
 * of all stratumn services
 */
export interface Endpoints {
  trace: string;
  account: string;
  media: string;
}

/**
 * The credential type of secret to authenticates
 * via email + password
 */
export interface CredentialSecret {
  email: string;
  password: string;
}

/**
 * Helper method to test that an object is of type CredentialSecret
 *
 * @param type the object to test
 */
export const isCredentialSecret = (type: any): type is CredentialSecret => {
  return type.email !== undefined;
};

/**
 * The private key type of secret to authenticates
 * via msg signature using provided private key
 */
export interface PrivateKeySecret {
  privateKey: string;
}

/**
 * Helper method to test that an object is of type PrivateKeySecret
 *
 * @param type the object to test
 */
export const isPrivateKeySecret = (type: any): type is PrivateKeySecret => {
  return type.privateKey !== undefined;
};

/**
 * The protected key type of secret to authenticates
 * via msg signature using password protected private key
 */
export interface ProtectedKeySecret {
  publicKey: string;
  password: string;
}

/**
 * Helper method to test that an object is of type ProtectedKeySecret
 *
 * @param type the object to test
 */
export const isProtectedKeySecret = (type: any): type is ProtectedKeySecret => {
  return type.publicKey !== undefined;
};

/**
 * The secret type
 */
export type Secret =  // the username + password case
  | CredentialSecret
  // the password protected signing key case
  | ProtectedKeySecret
  // the private key directly case
  | PrivateKeySecret;

/**
 * Options interface used to instantiate the Client.
 */
export interface ClientOptions {
  /**
   * To configure the endpoints. Can be a short tag like 'release' or 'staging'.
   * Can also be a struct to configure each service endpoint, eg: { trace: 'https://...' .. }.
   * Defaults to release endpoints.
   */
  endpoints?: Endpoints;

  /**
   * The secret used to authenticate the input.
   * Can be a signing key or a username + password.
   */
  secret: Secret;

  /**
   * This option is used to add request and response logging
   * for debugging purposes
   */
  enableDebugging?: boolean;
}

/**
 * The response format for a login request
 */
export interface LoginResponse {
  /**
   * The authentication token
   */
  token: string;
}

/**
 * The response format for a salt request
 */
export interface SaltResponse {
  /**
   * The salt value
   */
  salt: string;
}

/**
 * The fetch options
 */
export interface FetchOptions {
  /**
   * The authentication to use
   * (will not use the token provided via automatic login)
   * defaults to undefined
   */
  authToken?: string;

  /**
   * Flag to bypass the automatic login mechanism
   * defaults to false
   */
  skipAuth?: boolean;

  /**
   * The retry count
   * defaults to 1
   */
  retry?: number;
}

/**
 * The graphql options
 */
export interface GraphQLOptions {
  /**
   * The retry count
   * defaults to 1
   */
  retry?: number;
}
