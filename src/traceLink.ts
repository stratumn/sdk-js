import { Link, fromLinkObject } from '@stratumn/js-chainscript';
import { ITraceLink, TraceLinkType, TraceLinkMetaData } from './types';

/**
 * Convert a plain object to a TraceLink.
 * @param rawLink plain object.
 */
export function fromObject<TLinkData = any>(
  rawLink: any
): TraceLink<TLinkData> {
  return new TraceLink(fromLinkObject(rawLink));
}

/**
 * A TraceLink is an extension of a Chainscript Link
 * that provides useful methods
 */
export class TraceLink<TLinkData = any> extends Link
  implements ITraceLink<TLinkData> {
  constructor(link: Link) {
    // @ts-ignore we need to access the private link.link field
    super(link.link);
  }

  /**
   * The data of the link, as TLinkData for convenience
   *
   * @returns the data as TLinkData
   */
  data() {
    return super.data() as TLinkData;
  }

  /**
   * The id of the trace this link is a part of.
   *
   * @returns the trace id
   */
  traceId() {
    return this.mapId();
  }

  /**
   * The id of the workflow this link's trace is a part of.
   *
   * @returns the workflow id
   */
  workflowId() {
    return this.process().name;
  }

  /**
   * The type of the link.
   *
   * @returns a TraceLinkType
   */
  type() {
    return super.process().state as TraceLinkType;
  }

  /**
   * The link meta data as TraceLinkMetaData object
   * for convenience.
   *
   * @returns a TraceLinkMetaData object
   */
  metadata() {
    const md = super.metadata();
    // take extra caution around createdAt
    // as serialization will transform a Date
    // to a string..
    if (typeof md.createdAt === 'string') {
      md.createdAt = new Date(md.createdAt);
    }
    return md as TraceLinkMetaData;
  }

  /**
   * The id of the user who created the link.
   *
   * @returns the user id
   */
  createdBy() {
    return this.metadata().createdById;
  }

  /**
   * The date at which the link was created.
   *
   * @returns a Date object
   */
  createdAt() {
    return this.metadata().createdAt;
  }

  /**
   * The id of the owner of the trace.
   *
   * @returns the owner id
   */
  owner() {
    return this.metadata().ownerId;
  }

  /**
   * The id of the group under which the trace is.
   *
   * @returns the group id
   */
  group() {
    return this.metadata().groupId;
  }

  /**
   * The id of the form that was used to create the link.
   *
   * @returns the form id
   */
  form() {
    return this.metadata().formId;
  }

  /**
   * The id of the form that was last used to create the link.
   *
   * @returns the last form id
   */
  lastForm() {
    return this.metadata().lastFormId;
  }

  /**
   * The inputs of the link, used for transfer of ownership.
   *
   * @returns the inputs (array)
   */
  inputs() {
    return this.metadata().inputs;
  }
}
