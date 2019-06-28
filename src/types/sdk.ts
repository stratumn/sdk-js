import { sig } from '@stratumn/js-crypto';
import { ClientConfig } from './client';

/**
 * Config interface used to configure the Sdk.
 */
export interface SdkConfig extends ClientConfig {
  /**
   * The workflow id (instantiate one sdk per workflow)
   */
  workflowId: string;
}

/**
 * Setup interface for the sdk
 */
export interface SdkSetup {
  /**
   * The workflow id
   */
  workflowId: string;

  /**
   * The user id
   */
  userId: string;

  /**
   * The account id
   */
  accountId: string;

  /**
   * The group id
   */
  groupId: string;

  /**
   * The owner id
   */
  ownerId: string;

  /**
   * The private key used for signing links
   */
  signingPrivateKey: sig.SigningPrivateKey;
}
