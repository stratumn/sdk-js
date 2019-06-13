import { Link } from '@stratumn/js-chainscript';

/**
 * Config interface used to configure the Sdk.
 */
type EnvTag = 'release' | 'staging' | 'demo';
declare interface Config {
  /**
   * To configure the endpoints. Can be a short tag like 'release' or 'staging'.
   * Can also be a struct to configure each service endpoint, eg: { trace: 'https://...' .. }.
   * Defaults to release endpoints.
   */
  endpoints?:
    | EnvTag
    | {
        trace?: string;
        account?: string;
        media?: string;
      };
  /**
   * The workflow id (instantiate one sdk per workflow)
   */
  workflowId: string;
  /**
   * The secret used to authenticate the input.
   * Can be a signing key or a username + password.
   */
  secret: any;
}

/**
 * Interface used as argument to create a new trace.
 * User must provide the form id to use and the form data.
 */
declare interface NewTraceInput {
  formId: string;
  data: any;
}

/**
 * Interface used as argument to append a new link to a trace.
 * User must provide the trace id, form id, form data and previous link hash.
 * The key difference with the NewTraceInput is that the trace id and the
 * previous link hash must be provided.
 */
declare interface AppendTraceInput {
  traceId: string;
  formId: string;
  data: any;
  prevLinkHash: Uint8Array;
}

/**
 * Interface used as argument to transfer (push) a trace.
 * User must provide the trace id, recipient id and previous link hash.
 * User can optionally provide some data to be set in the link.
 */
declare interface TransferRequestInput {
  traceId: string;
  recipient: string;
  data?: any;
  prevLinkHash: Uint8Array;
}

/**
 * Interface used as argument to respond to a transfer.
 * User must provide the trace id and previous link hash.
 * User can optionally provide some data to be set in the link.
 */
declare interface TransferResponseInput {
  traceId: string;
  data?: any;
  prevLinkHash: Uint8Array;
}

/**
 * TraceLink extends a CS.Link with some helper methods like
 * createdBy, createdAt etc..
 */
declare interface TraceLink extends Link {
  // add trace like methods here, for ex:
  createdBy(): string;
  createdAt(): Date;
  // ...
}

/**
 * The state of trace is composed of some abstract data
 * validated against a schema and the head of the the trace.
 */
declare interface TraceState {
  data: any;
  head: TraceLink;
}

/**
 * The Stratumn Sdk
 */
export declare class Sdk {
  constructor(config: Config);

  /**
   * Creates a new trace.
   * @returns the TraceState
   */
  newTrace(input: NewTraceInput): Promise<TraceState>;
  /**
   * Appends a new link to a trace.
   * @returns the TraceState
   */
  appendTrace(input: AppendTraceInput): Promise<TraceState>;
  /**
   * Appends a new link to a trace.
   * @returns the TraceState
   */
  transferTrace(input: TransferRequestInput): Promise<TraceState>;
  /**
   * Accepts the transfer of ownership of a trace.
   * @returns the TraceState
   */
  acceptTransfer(input: TransferResponseInput): Promise<TraceState>;
  /**
   * Rejects the transfer of ownership of a trace.
   * @returns the TraceState
   */
  rejectTransfer(input: TransferResponseInput): Promise<TraceState>;
  /**
   * Cancels the transfer of ownership of a trace.
   * @returns the TraceState
   */
  cancelTransfer(input: TransferResponseInput): Promise<TraceState>;

  /**
   * Returns the state of a given trace.
   * @returns the TraceState
   */
  getTraceState(traceId: string): Promise<TraceState>;
  /**
   * Returns the details of a given trace (all the links).
   * @returns the TraceState
   */
  getTraceDetails(traceId: string): Promise<TraceLink[]>;
}
