import { LinkBuilder } from '@stratumn/js-chainscript';
import { stringify } from '@stratumn/canonicaljson';
import crypto from 'crypto';
import uuid from 'uuid/v4';
import {
  TraceLinkType,
  TraceLinkMetaData,
  TraceLinkBuilderConfig,
  TraceActionType,
  ITraceLink
} from './types';
import { TraceLink } from './traceLink';

/**
 * TraceLinkBuilder makes it easy to create links that are compatible
 * with Trace.
 * It provides valid default values for required fields and allows the user
 * to set fields to valid values.
 */
export class TraceLinkBuilder<TLinkData = any> extends LinkBuilder {
  private metadata: Partial<TraceLinkMetaData>;
  private parentLink?: ITraceLink;
  private formData?: TLinkData;

  /**
   * Create a new instance of a TraceLinkBuilder.
   *
   * If a parent link is provided, then the trace id
   * and priority will be calculated from it.
   *
   * If no parent link is provided, then it is assumed that
   * the link will be the first of a new trace and priority is set to 1.
   *
   * @param cfg the config to instantiate the builder
   */
  constructor(cfg: TraceLinkBuilderConfig) {
    // extract info from config
    const { workflowId, parentLink } = cfg;

    // trace id is either retrieved from parent link when it is provided
    // or set to a new uuid.
    const traceId = parentLink ? parentLink.traceId() : uuid();

    // now we can call the super constructor
    super(workflowId, traceId);

    // set the parent link
    this.parentLink = parentLink;

    // degree is always 1
    super.withDegree(1);

    // set priority to 1 by default
    // may be overriden if parent link was provided
    super.withPriority(1);

    // set the created at timestamp
    this.metadata = { createdAt: new Date() };

    // if parent link was provided set the parent hash and priority
    if (this.parentLink) {
      super
        // increment the priority by 1
        .withPriority(this.parentLink.priority() + 1)
        // use parent link hash
        .withParent(this.parentLink.hash());
    }
  }

  /**
   * Helper method to get the parent link.
   * Will throw if no parent link was provided.
   */
  private getParentLink() {
    if (!this.parentLink) {
      throw new Error('Parent link must be provided');
    }
    return this.parentLink;
  }

  /**
   * Set the data field to the hash of the object argument.
   *
   * @param obj the optional object to be hashed
   */
  private withHashedData(obj?: TLinkData) {
    if (obj) {
      const algo = 'sha256';
      const hash = crypto
        .createHash(algo)
        .update(stringify(obj))
        .digest('base64');
      this.withData({
        algo,
        hash
      });
      this.formData = obj;
    }
    return this;
  }

  /**
   * Helper method used to configure a link for an attestation.
   * User must still set owner, group and createdBy separately.
   *
   * @param actionKey the name of the action associated with the form
   * @param data the data of the attestation
   */
  public forAttestation(actionKey: string, data: TLinkData) {
    const type: TraceLinkType = 'OWNED';
    this.withHashedData(data)
      .withAction(actionKey)
      .withProcessState(type);
    this.metadata.formId = actionKey;
    return this;
  }

  /**
   * Helper method used for transfer of ownership requests (push and pull).
   * Note that owner and group are calculated from parent link.
   * Parent link must have been provided!
   *
   * @param to the group to which the transfer is made for
   * @param action the action (_PUSH_OWNERSHIP_ or _PULL_OWNERSHIP_)
   * @param type the type (PUSHING OR PULLING)
   * @param data the optional data
   */
  private forTransferRequest(
    to: string,
    action: TraceActionType,
    type: TraceLinkType,
    data?: TLinkData
  ) {
    const parent = this.getParentLink();
    this.withOwner(parent.owner())
      .withGroup(parent.group())
      .withHashedData(data)
      .withAction(action)
      .withProcessState(type);
    this.metadata.inputs = [to];
    this.metadata.lastFormId = parent.form() || parent.lastForm();
    return this;
  }

  /**
   * Helper method used for pushing ownership to another group.
   *
   * @param to the group to which the trace is pushed to
   * @param data the optional data
   */
  public forPushTransfer(to: string, data?: TLinkData) {
    return this.forTransferRequest(to, '_PUSH_OWNERSHIP_', 'PUSHING', data);
  }

  /**
   * Helper method used for pulling ownership from another group.
   *
   * @param to the group to which the trace is pulled to
   * @param data the optional data
   */
  public forPullTransfer(to: string, data?: TLinkData) {
    return this.forTransferRequest(to, '_PULL_OWNERSHIP_', 'PULLING', data);
  }

  /**
   * Helper method used to cancel a transfer request.
   * Note that owner and group are calculated from parent link.
   * Parent link must have been provided!
   *
   * @param data the optional data
   */
  public forCancelTransfer(data?: TLinkData) {
    const parent = this.getParentLink();
    const action: TraceActionType = '_CANCEL_TRANSFER_';
    const type: TraceLinkType = 'OWNED';
    this.withOwner(parent.owner())
      .withGroup(parent.group())
      .withHashedData(data)
      .withAction(action)
      .withProcessState(type);
    return this;
  }

  /**
   * Helper method used to reject a transfer request.
   * Note that owner and group are calculated from parent link.
   * Parent link must have been provided!
   *
   * @param data the optional data
   */
  public forRejectTransfer(data?: TLinkData) {
    const parent = this.getParentLink();
    const action: TraceActionType = '_REJECT_TRANSFER_';
    const type: TraceLinkType = 'OWNED';
    this.withOwner(parent.owner())
      .withGroup(parent.group())
      .withHashedData(data)
      .withAction(action)
      .withProcessState(type);
    return this;
  }

  /**
   * Helper method used to accept a transfer request.
   * Parent link must have been provided!
   * User must still set owner, group and createdBy separately.
   *
   * @param data the optional data
   */
  public forAcceptTransfer(data?: TLinkData) {
    // call parent link to assert it was set
    this.getParentLink();
    const action: TraceActionType = '_ACCEPT_TRANSFER_';
    const type: TraceLinkType = 'OWNED';
    this.withHashedData(data)
      .withAction(action)
      .withProcessState(type);
    return this;
  }

  /**
   * To set the metadata ownerId.
   *
   * @param ownerId the owner id
   */
  public withOwner(ownerId: string) {
    this.metadata.ownerId = ownerId;
    return this;
  }

  /**
   * To set the metadata groupId.
   *
   * @param groupId the group id
   */
  public withGroup(groupId: string) {
    this.metadata.groupId = groupId;
    return this;
  }

  /**
   * To set the metadata createdById.
   *
   * @param userId the user id
   */
  public withCreatedBy(userId: string) {
    this.metadata.createdById = userId;
    return this;
  }

  /**
   * To build the link.
   */
  public build() {
    super.withMetadata(this.metadata);
    const link = super.build();
    return new TraceLink<TLinkData>(link, this.formData);
  }
}
