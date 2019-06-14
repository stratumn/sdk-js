import { Link } from '@stratumn/js-chainscript';

type LinkHash = Uint8Array;
type TODO = any;

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
  secret:  // the username + password case
    | { email: string; password: string }
    // the password protected signing key case
    | { publicKey: string; password: string }
    // the private key directly case
    | { privateKey: string };
}

/**
 * Interface used as argument to create a new trace.
 * User must provide the form id to use and the form data.
 */
declare interface NewTraceInput<TLink = any> {
  formId: string;
  data: TLink;
}

/**
 * Interface used as argument to append a new link to a trace.
 * User must provide the trace id, form id and form data.
 * User can optionally provide the previous link hash, if not it will be fetched
 * from the API first.
 * The key difference with the NewTraceInput is that the trace id must be provided.
 */
declare interface AppendLinkInput<TLink = any> {
  traceId: string;
  formId: string;
  data: TLink;
  prevLinkHash?: LinkHash;
}

/**
 * Interface used as argument to transfer (push) a trace.
 * User must provide the trace id.
 * User can optionally provide the previous link hash, if not it will be fetched
 * from the API first.
 * User can optionally provide some data to be set in the link.
 * The recipient id is optional if it is a pull transfer, but mandatory in the
 * case of a push transfer.
 */
declare interface TransferRequestInput<TLink = any> {
  traceId: string;
  recipient?: string;
  data?: TLink;
  prevLinkHash?: LinkHash;
}

/**
 * Interface used as argument to respond to a transfer.
 * User must provide the trace id.
 * User can optionally provide the previous link hash, if not it will be fetched
 * from the API first.
 * User can optionally provide some data to be set in the link.
 */
declare interface TransferResponseInput<TLink = any> {
  traceId: string;
  data?: TLink;
  prevLinkHash?: LinkHash;
}

/**
 * Interface used as argument to get the trace state.
 * User must provide the trace id.
 */
declare interface GetTraceStateInput {
  traceId: string;
}

/**
 * Interface used as argument to get the trace details.
 * User must provide the trace id.
 * For pagination, user can provide either:
 * - first
 * - first and after
 * - last
 * - last and before
 */
declare interface GetTraceDetailsInput {
  traceId: string;
  first?: number;
  after?: string;
  last?: number;
  before?: string;
}

/**
 * TraceLink extends a CS.Link with some helper methods:
 * - traceId
 * - createdBy
 * - createdAt
 * - owner
 * - groupId
 * - formId
 */
declare interface TraceLink extends Link {
  traceId(): string;
  createdBy(): TODO;
  createdAt(): Date;
  owner(): TODO;
  groupId(): string;
  formId(): string;
}

/**
 * The state of trace is composed of:
 * - the trace id
 * - the link hash of the head of the trace
 * - the date at which it was last updated
 * - the person who last updated it
 * - some abstract data validated against a predefined schema
 */
declare interface TraceState<TState = any> {
  traceId: string;
  headLinkHash: LinkHash;
  updatedAt: Date;
  updatedBy: TODO;
  data: TState;
}

/**
 * The details of a trace contains:
 * - the requested links
 * - the total count of links in the trace
 * - some pagination information
 */
declare interface TraceDetails {
  links: TraceLink[];
  totalCount: number;
  info: {
    hasNext: boolean;
    hasPrevious: boolean;
    startCursor?: string;
    endCursor?: string;
  };
}

/**
 * The Stratumn Sdk.
 * One Sdk per workflow.
 * One State schema per workflow hence the possibility
 * to specify the shape of the state at the Sdk level via generics.
 */
export declare class Sdk<TState = any> {
  constructor(config: Config);

  /**
   * Creates a new trace.
   * @returns the TraceState
   */
  newTrace<TLink>(input: NewTraceInput<TLink>): Promise<TraceState<TState>>;
  /**
   * Appends a new link to a trace.
   * @returns the TraceState
   */
  appendLink<TLink>(input: AppendLinkInput<TLink>): Promise<TraceState<TState>>;
  /**
   * Push a trace to a recipient group.
   * @returns the TraceState
   */
  pushTrace<TLink>(
    input: TransferRequestInput<TLink>
  ): Promise<TraceState<TState>>;
  /**
   * Pull a trace from current owner.
   * @returns the TraceState
   */
  pullTrace<TLink>(
    input: TransferRequestInput<TLink>
  ): Promise<TraceState<TState>>;
  /**
   * Accepts the transfer of ownership of a trace.
   * @returns the TraceState
   */
  acceptTransfer<TLink>(
    input: TransferResponseInput<TLink>
  ): Promise<TraceState<TState>>;
  /**
   * Rejects the transfer of ownership of a trace.
   * @returns the TraceState
   */
  rejectTransfer<TLink>(
    input: TransferResponseInput<TLink>
  ): Promise<TraceState<TState>>;
  /**
   * Cancels the transfer of ownership of a trace.
   * @returns the TraceState
   */
  cancelTransfer<TLink>(
    input: TransferResponseInput<TLink>
  ): Promise<TraceState<TState>>;

  /**
   * Returns the state of a given trace.
   * @returns the TraceState
   */
  getTraceState(input: GetTraceStateInput): Promise<TraceState<TState>>;
  /**
   * Returns the details of a given trace (all the links).
   * @returns the TraceState
   */
  getTraceDetails(input: GetTraceDetailsInput): Promise<TraceDetails>;
}
