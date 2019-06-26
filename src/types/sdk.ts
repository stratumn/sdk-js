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
