import { sig } from '@stratumn/js-crypto';
import { ClientOptions } from './client';

/**
 * Options interface used to instantiate the Sdk.
 */
export interface SdkOptions extends ClientOptions {
  /**
   * The workflow id (instantiate one sdk per workflow)
   */
  workflowId: string;
}

/**
 * Config interface for the sdk
 */
export interface SdkConfig {
  /**
   * The workflow id
   */
  workflowId: string;

  /**
   * The workflow config id
   */
  configId: string;

  /**
   * The account id
   */
  accountId: string;

  /**
   * The group id
   */
  groupId: string;

  /**
   * The private key used for signing links
   */
  signingPrivateKey: sig.SigningPrivateKey;
}
