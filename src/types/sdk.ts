/**
 * Config interface used to configure the Sdk.
 */
export type EnvTag = 'release' | 'staging' | 'demo';
export type Service = 'trace' | 'account' | 'media';
export interface Endpoints {
  trace: string;
  account: string;
  media: string;
}

export interface CredentialSecret {
  email: string;
  password: string;
}

export const isCredentialSecret = (type: any): type is CredentialSecret => {
  return type.email !== undefined;
};

export interface PrivateKeySecret {
  privateKey: string;
}

export const isPrivateKeySecret = (type: any): type is PrivateKeySecret => {
  return type.privateKey !== undefined;
};

export interface ProtectedKeySecret {
  publicKey: string;
  password: string;
}

export const isProtectedKeySecret = (type: any): type is ProtectedKeySecret => {
  return type.publicKey !== undefined;
};

export type Secret =  // the username + password case
  | CredentialSecret
  // the password protected signing key case
  | ProtectedKeySecret
  // the private key directly case
  | PrivateKeySecret;

export interface Config {
  /**
   * To configure the endpoints. Can be a short tag like 'release' or 'staging'.
   * Can also be a struct to configure each service endpoint, eg: { trace: 'https://...' .. }.
   * Defaults to release endpoints.
   */
  endpoints?: EnvTag | Endpoints;
  /**
   * The workflow id (instantiate one sdk per workflow)
   */
  workflowId: string;
  /**
   * The secret used to authenticate the input.
   * Can be a signing key or a username + password.
   */
  secret: Secret;
}
