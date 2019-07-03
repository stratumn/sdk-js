import { Link } from '@stratumn/js-chainscript';
import { Account } from './account';

/**
 * The various link types.
 */
export type TraceLinkType = 'OWNED' | 'PUSHING' | 'PULLING';

/**
 * The various action types.
 */
export type TraceActionType =
  | '_ATTESTATION_'
  | '_PUSH_OWNERSHIP_'
  | '_PULL_OWNERSHIP_'
  | '_ACCEPT_TRANSFER_'
  | '_CANCEL_TRANSFER_'
  | '_REJECT_TRANSFER_';

/**
 * The various stage types.
 */
export type TraceStageType = 'INCOMING' | 'OUTGOING' | 'BACKLOG';

/**
 * The link metadata
 */
export interface TraceLinkMetaData {
  ownerId: string;
  groupId: string;
  formId?: string;
  lastFormId?: string;
  createdAt: Date;
  createdById: string;
  inputs?: string[];
}
/**
 * Interface extending a Chainscript Link
 * with common trace methods.
 */
export interface ITraceLink<TLinkData = any> extends Link {
  formData(): TLinkData;
  traceId(): string;
  workflowId(): string;
  type(): TraceLinkType;
  createdBy(): Account;
  createdAt(): Date;
  owner(): Account;
  group(): string;
  form(): string | undefined;
  lastForm(): string | undefined;
  inputs(): string[] | undefined;
  metadata(): TraceLinkMetaData;
}

/**
 * Interface used as argument to create a new trace.
 * User must provide the form id to use and the form data.
 */
export interface NewTraceInput<TLinkData = any> {
  formId: string;
  data: TLinkData;
}

/**
 * Interface used as argument to append a new link to a trace.
 * User must provide the trace id, form id and form data.
 * User can optionally provide the previous link hash, if not it will be fetched
 * from the API first.
 * The key difference with the NewTraceInput is that the trace id must be provided.
 */
export interface AppendLinkInput<TLinkData = any> {
  traceId?: string;
  formId: string;
  data: TLinkData;
  prevLink?: ITraceLink;
}

/**
 * Interface used as argument to push a trace.
 * User must provide the trace id and the recipient id.
 * User can optionally provide the previous link hash, if not it will be fetched
 * from the API first.
 * User can optionally provide some data to be set in the link.
 */
export interface PushTransferInput<TLinkData = any> {
  traceId?: string;
  recipient: string;
  data?: TLinkData;
  prevLink?: ITraceLink;
}

/**
 * Interface used as argument to pull a trace.
 * User must provide the trace id.
 * User can optionally provide the previous link hash, if not it will be fetched
 * from the API first.
 * User can optionally provide some data to be set in the link.
 */
export interface PullTransferInput<TLinkData = any> {
  traceId?: string;
  data?: TLinkData;
  prevLink?: ITraceLink;
}

/**
 * Interface used as argument to respond to a transfer.
 * User must provide the trace id.
 * User can optionally provide the previous link hash, if not it will be fetched
 * from the API first.
 * User can optionally provide some data to be set in the link.
 */
export interface TransferResponseInput<TLinkData = any> {
  traceId?: string;
  data?: TLinkData;
  prevLink?: ITraceLink;
}

/**
 * Interface used as argument to get the trace state.
 * User must provide the trace id.
 */
export interface GetTraceStateInput {
  traceId: string;
}

/**
 * The pagination info.
 */
export interface PaginationInfo {
  first?: number;
  after?: string;
  last?: number;
  before?: string;
}

/**
 * The pagination results.
 */
export interface PaginationResult {
  totalCount: number;
  info: {
    hasNext: boolean;
    hasPrevious: boolean;
    startCursor?: string;
    endCursor?: string;
  };
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
export interface GetTraceDetailsInput extends PaginationInfo {
  traceId: string;
}

/**
 * The state of trace is composed of:
 * - the trace id
 * - the link hash of the head of the trace
 * - the date at which it was last updated
 * - the person who last updated it
 * - some abstract data validated against a predefined schema
 */
export interface TraceState<TState = any, TLinkData = any> {
  traceId: string;
  headLink: ITraceLink<TLinkData>;
  updatedAt: Date;
  updatedBy: Account;
  data: TState;
}

/**
 * The details of a trace contains:
 * - the requested links
 * - the total count of links in the trace
 * - some pagination information
 */
export interface TraceDetails extends PaginationResult {
  links: ITraceLink[];
}

/**
 * A collection of traces state.
 */
export interface TracesState<TState = any> extends PaginationResult {
  traces: TraceState<TState>[];
}

/**
 * The configuration interface for a new TraceLinkBuilder.
 */
export interface TraceLinkBuilderConfig {
  workflowId: string;
  parentLink?: ITraceLink;
}
