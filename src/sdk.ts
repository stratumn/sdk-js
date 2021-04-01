import { sig } from '@stratumn/js-crypto';
import {
  SdkOptions,
  SdkConfig,
  NewTraceInput,
  isPrivateKeySecret,
  AppendLinkInput,
  TraceState,
  PushTransferInput,
  PullTransferInput,
  TransferResponseInput,
  GetTraceStateInput,
  GetTraceDetailsInput,
  TraceDetails,
  PaginationInfo,
  TraceStageType,
  TracesState,
  FileInfo,
  AddTagsToTraceInput,
  SearchTracesFilter
} from './types';
import {
  ConfigQuery,
  CreateLinkMutation,
  GetHeadLinkQuery,
  GetTraceStateQuery,
  GetTraceDetailsQuery,
  GetTracesInStageQuery,
  Fragments,
  AddTagsToTraceMutation,
  SearchTracesQuery
} from './graphql';
import { Client } from './client';
import { TraceLinkBuilder } from './traceLinkBuilder';
import { fromObject, TraceLink } from './traceLink';
import {
  extractFileWrappers,
  assignObjects,
  extractFileRecords
} from './helpers';
import { FileWrapper, NodeJsFileBlobWrapper } from './fileWrapper';
import { Mutex } from 'async-mutex';
import { FileRecord } from './fileRecord';

const ERROR_CONFIG_DEPRECATED = 'link config deprecated';

/**
 * The Stratumn javascript Sdk
 */
export class Sdk<TState = any> {
  /**
   * The Sdk options
   */
  private opts: SdkOptions;

  /**
   * The underlying REST / GraphQL client
   */
  private client: Client;

  /**
   * The config object for the given workflow
   */
  private config?: SdkConfig;
  /**
   * The mutex used to prevent concurrent config requests
   */
  private mutex: Mutex;
  /**
   * Constructs a new instance of the Sdk
   * @param opts the Sdk options
   */
  constructor(opts: SdkOptions) {
    this.opts = opts;
    this.client = new Client(opts);
    this.mutex = new Mutex();
  }

  /*********************************************************
   *                   private methods                     *
   *********************************************************/

  /**
   * Retrieves the Sdk config for the given workflow.
   * If the config has not yet been computed, the Sdk will
   * run a GraphQL query to retrieve the relevant info
   * and will generate the config.
   *
   * @param forceUpdate set to true if we want to force update the config
   * @returns the Sdk config object
   */
  private async getConfig(forceUpdate = false): Promise<SdkConfig> {
    // acquire the mutex
    const release = await this.mutex.acquire();

    try {
      // if the config already exists use it!
      if (this.config && !forceUpdate) {
        release();
        return this.config;
      }

      // extract the workflow id from the options
      const { workflowId } = this.opts;

      // shortcut types
      type Response = ConfigQuery.Response;
      type Variables = ConfigQuery.Variables;

      // run the GraphQL ConfigQuery
      const rsp = await this.client.graphql<Response, Variables>(
        ConfigQuery.document,
        { workflowId }
      );

      // extract relevant info from the response
      const {
        account: {
          accountId,
          signingKey,
          user,
          bot
        },
        workflow
      } = rsp;

      if (!workflow?.groups) {
        throw new Error(`Cannot find workflow ${workflowId}`);
      }

      const {
        groups,
        config: { id: configId }
      } = workflow;

      // get all the account ids I am a member of
      const myAccounts = (user?.memberOf || bot?.teams)?.nodes.map(a => a.accountId);

      // get all the groups I belong to
      // i.e. where I belong to one of the account members
      const myGroups = groups.nodes.filter(g =>
        g.members.nodes.some(m => myAccounts?.includes(m.accountId))
      );

      // there must be at most one group!
      if (myGroups.length > 1) {
        throw new Error('More than one group to choose from.');
      }
      // there must be at least one group!
      if (myGroups.length === 0) {
        throw new Error('No group to choose from.');
      }

      // extract info from my only group
      const [{ groupId }] = myGroups;

      // retrieve the signing private key
      let signingPrivateKey: sig.SigningPrivateKey;
      if (isPrivateKeySecret(this.opts.secret)) {
        // if the secret is a PrivateKeySecret, use it!
        signingPrivateKey = new sig.SigningPrivateKey({
          pemPrivateKey: this.opts.secret.privateKey
        });
      } else if (!signingKey?.privateKey.passwordProtected) {
        // otherwise use the key from the response
        // if it's not password protected!
        signingPrivateKey = new sig.SigningPrivateKey({
          pemPrivateKey: signingKey?.privateKey.decrypted
        });
      } else {
        throw new Error('Cannot get signing private key');
      }

      // store the new config
      this.config = {
        configId,
        workflowId,
        accountId,
        groupId,
        signingPrivateKey,
      };

      // in case no error were thrown, release here
      release();

      // return the new config
      return this.config;
    } catch (err) {
      // always release before rethrowing the error.
      release();
      throw err;
    }
  }

  /**
   * Builds the TraceState object from the TraceState fragment response
   *
   * @param trace the trace fragment response
   * @returns the trace state
   */
  private makeTraceState<TLinkData = any>(
    trace: Fragments.TraceState.Response
  ) {
    // retrieve parent link
    const headLink = fromObject<TLinkData>(trace.head.raw, trace.head.data);

    // build the TraceState object
    const state: TraceState<TState, TLinkData> = {
      traceId: headLink.traceId(),
      headLink,
      updatedAt: new Date(trace.updatedAt),
      updatedBy: headLink.createdBy(),
      data: trace.state.data,
      tags: trace.tags || []
    };
    return state;
  }

  /**
   * Creates a new Link from the given builder, signs it and
   * executes the GraphQL mutation.
   *
   * @param input the input argument to create the Link
   * @param firstTry if this is not the first try, do not retry
   * @returns the Trace
   */
  private async createLink<TLinkData>(
    linkBuilder: TraceLinkBuilder<TLinkData>,
    firstTry: boolean = true
  ): Promise<TraceState<TState, TLinkData>> {
    // extract signing key from config
    const { signingPrivateKey } = await this.getConfig();

    // build the link
    const link = linkBuilder.build();

    // sign the link
    link.sign(signingPrivateKey.export(), '[version,data,meta]');

    // shortcut types
    type Response = CreateLinkMutation.Response;
    type Variables = CreateLinkMutation.Variables;

    try {
      // execute the graphql mutation
      const rsp = await this.client.graphql<Response, Variables>(
        // the graphql document
        CreateLinkMutation.document,
        // export the link as object
        { link: link.toObject({ bytes: String }), data: link.formData() }
      );

      // build and return the TraceState object
      return this.makeTraceState<TLinkData>(rsp.createLink.trace);
    } catch (err) {
      if (
        firstTry &&
        err &&
        err.response &&
        Array.isArray(err.response.errors) &&
        err.response.errors.some(
          (e: any) => e.message === ERROR_CONFIG_DEPRECATED
        )
      ) {
        // If the wf config is deprecated, refetch it and retry
        const { configId } = await this.getConfig(true);

        // clean signatures
        // @ts-ignore
        link.link.signatures = [];

        // Update the config ID in the link builder
        linkBuilder.withConfigId(configId);

        return this.createLink(linkBuilder, false);
      }
      throw err;
    }
  }

  /**
   * Given a trace id or a previous link return the previous link.
   *
   * @param input.traceId the id of the trace
   * @param input.prevLink the previous link
   */
  private async getHeadLink(input: { traceId?: string; prevLink?: TraceLink }) {
    // if prevLink was provided then return it
    if (input.prevLink) {
      return input.prevLink;
    }

    // if trace id was provided, retrieve the head from api.
    if (input.traceId) {
      // shortcut types
      type Response = GetHeadLinkQuery.Response;
      type Variables = GetHeadLinkQuery.Variables;

      // execute the graphql query
      const rsp = await this.client.graphql<Response, Variables>(
        GetHeadLinkQuery.document,
        {
          traceId: input.traceId
        }
      );

      // convert the raw response to a link object
      const headLink = fromObject(rsp.trace.head.raw, rsp.trace.head.data);

      // return the link
      return headLink;
    }
    throw new Error('Previous link or trace id must be provided');
  }

  /**
   * Get the traces in a given stage (INCOMING, OUTGOING, BACKLOG, ATTESTATION)
   * When stageType=ATTESTATION, you must also provide the form id to
   * identify the stage.
   * If no stage correspond to the stageType x actionKey, it will throw.
   * If more than one stage is found it will also throw.
   *
   * @param stageType the stage type
   * @param paginationInfo the pagination info
   * @param actionKey (optional) the actionKey in case of ATTESTATION
   * @return the traces in a given stage
   */
  private async getTracesInStage(
    stageType: TraceStageType,
    paginationInfo: PaginationInfo,
    actionKey?: string
  ) {
    // actionKey can only be set in ATTESTATION case
    if ((stageType === 'ATTESTATION') !== !!actionKey) {
      throw new Error(
        'You must and can only provide actionKey when stageType is ATTESTATION'
      );
    }
    // extract info from config
    const { groupId } = await this.getConfig();

    // shortcut types
    type Response = GetTracesInStageQuery.Response;
    type Variables = GetTracesInStageQuery.Variables;

    // create variables
    const variables: Variables = {
      groupId,
      stageType,
      actionKey,
      ...paginationInfo
    };

    // execute the graphql query
    const rsp = await this.client.graphql<Response, Variables>(
      GetTracesInStageQuery.document,
      variables
    );

    // get the stages from the response
    const stages = rsp.group.stages.nodes;

    // there must be exactly one stage
    if (stages.length === 1) {
      // get the stage
      const [stage] = stages;

      // extract traces response and pagination
      const { nodes, info, totalCount } = stage.traces;

      // constructs result
      const res: TracesState<TState> = {
        traces: nodes.map(this.makeTraceState),
        info,
        totalCount
      };

      // return result
      return res;
    }

    // compute detail for error
    const stageDetail = `${stageType}${actionKey ? `:${actionKey}` : ''}`;

    // throw if no stages were found
    if (stages.length === 0) {
      throw new Error(`No ${stageDetail} stage`);
    }

    // throw if multiple stages were found
    throw new Error(`Multiple ${stageDetail} stages`);
  }

  /**
   * Upload files in a idToFile map to Media service.
   *
   * @param idToFileWrapperMap the map containing all file wrappers to upload
   * @returns a map id => FileRecord
   */
  private async uploadFiles(idToFileWrapperMap: Map<string, FileWrapper>) {
    // if the map is empty return an empty map
    if (!idToFileWrapperMap.size) {
      return new Map<string, FileRecord>();
    }

    // build an array of id x file info
    const fileInfos = await Promise.all(
      Array.from(idToFileWrapperMap.entries()).map(
        async ([id, file]) => <[string, FileInfo]>[id, await file.info()]
      )
    );

    // use the underlying client to upload all files in map
    const data = await this.client.uploadFiles(
      Array.from(idToFileWrapperMap.values())
    );

    // remap the resulting media record in a map id => FileRecord
    return new Map(
      data.map((record, idx) => {
        const [id, info] = fileInfos[idx];
        return [id, new FileRecord(record, info)];
      })
    );
  }

  /**
   * Extract, upload and replace all file wrappers in a link data object.
   *
   * @param data the link data that contains file wrappers to upload
   */
  private async uploadFilesInLinkData<TLinkData>(data: TLinkData) {
    // extract file wrappers and corresponding paths
    const {
      idToObjectMap: idToFileWrapperMap,
      pathToIdMap
    } = extractFileWrappers(data);

    // upload files and retrieve file records
    const idToFileRecordMap = await this.uploadFiles(idToFileWrapperMap);

    // assign file records back in data
    return assignObjects<FileWrapper, FileRecord, TLinkData>(
      data,
      pathToIdMap,
      idToFileRecordMap
    );
  }

  /**
   * Download all the files in a map from Media service.
   *
   * @param idToFileRecordMap the map containing all file records to download
   * @returns a map id => FileWrapper
   */
  private async downloadFiles(idToFileRecordMap: Map<string, FileRecord>) {
    // if the map is empty nothing to do.
    if (!idToFileRecordMap.size) {
      return new Map<string, FileWrapper>();
    }

    // download all files in the map and create FileWrapper
    // around the returned blob data.
    const promises = Array.from(idToFileRecordMap.entries()).map(
      async ([id, record]) => {
        const file = await this.client.downloadFile(record);
        return [id, new NodeJsFileBlobWrapper(file, record, !record.key)] as [
          string,
          FileWrapper
        ];
      }
    );

    // wait for all downloads to finish.
    const fileWrappers = await Promise.all(promises);

    // return the idToFileWrapper map
    return new Map(fileWrappers);
  }

  /*********************************************************
   *                   public methods                      *
   *********************************************************/

  /**
   * Creates a new Trace.
   *
   * @param input  the newTrace input argument
   * @returns the new Trace
   */
  public async newTrace<TLinkData>(input: NewTraceInput<TLinkData>) {
    // extract info from input
    const { data, actionKey, formId } = input;

    const action = actionKey || formId;
    if (!action) {
      throw new Error('one of actionKey or formId should be provided');
    }

    // extract info from config
    const { workflowId, accountId, groupId, configId } = await this.getConfig();

    // upload files and transform data
    const dataAfterFileUpload = await this.uploadFilesInLinkData(data);

    // use a TraceLinkBuilder to create the first link
    const linkBuilder = new TraceLinkBuilder<typeof dataAfterFileUpload>({
      // only provide workflowId to initiate a new trace
      workflowId,
      configId
    })
      // this is an attestation
      .forAttestation(action, dataAfterFileUpload)
      // add group info
      .withGroup(groupId)
      // add creator info
      .withCreatedBy(accountId);

    // call createLink helper
    return this.createLink(linkBuilder);
  }

  /**
   * Add tags to an existing trace.
   *
   * @param input  the input argument
   * @returns the Trace
   */
  public async addTagsToTrace<TLinkData = any>(input: AddTagsToTraceInput) {
    const { traceId, tags } = input;

    // shortcut types
    type Response = AddTagsToTraceMutation.Response;
    type Variables = AddTagsToTraceMutation.Variables;

    // execute the graphql mutation
    const rsp = await this.client.graphql<Response, Variables>(
      // the graphql document
      AddTagsToTraceMutation.document,
      // export the link as object
      { traceId, tags }
    );

    // build and return the TraceState object
    return this.makeTraceState<TLinkData>(rsp.addTagsToTrace.trace);
  }

  /**
   * Appends a new Link to a Trace.
   *
   * @param input  the appendLink input argument
   * @returns the Trace
   */
  public async appendLink<TLinkData>(input: AppendLinkInput<TLinkData>) {
    // retrieve parent link
    const parentLink = await this.getHeadLink(input);

    // extract info from input
    const { data, actionKey, formId } = input;

    const action = actionKey || formId;
    if (!action) {
      throw new Error('one of actionKey or formId should be provided');
    }

    // extract info from config
    const { workflowId, accountId, groupId, configId } = await this.getConfig();

    // upload files and transform data
    const dataAfterFileUpload = await this.uploadFilesInLinkData(data);

    // use a TraceLinkBuilder to create the next link
    const linkBuilder = new TraceLinkBuilder<typeof dataAfterFileUpload>({
      // provide workflow id
      workflowId,
      // and parent link to append to the existing trace
      parentLink,
      configId
    })
      // this is an attestation
      .forAttestation(action, dataAfterFileUpload)
      // add group info
      .withGroup(groupId)
      // add creator info
      .withCreatedBy(accountId);

    // call createLink helper
    return this.createLink(linkBuilder);
  }

  /**
   * Push a trace to a recipient group.
   *
   * @param input the pushTrace input argument
   * @returns the Trace
   */
  public async pushTrace<TLinkData>(input: PushTransferInput<TLinkData>) {
    // retrieve parent link
    const parentLink = await this.getHeadLink(input);

    // extract info from input
    const { data, recipient } = input;

    // extract info from config
    const { workflowId, accountId, configId } = await this.getConfig();

    // use a TraceLinkBuilder to create the next link
    const linkBuilder = new TraceLinkBuilder<TLinkData>({
      // provide workflow id
      workflowId,
      // and wf config ID
      configId,
      // and parent link to append to the existing trace
      parentLink
    })
      // this is a push transfer
      .forPushTransfer(recipient, data)
      // add creator info
      .withCreatedBy(accountId);

    // call createLink helper
    return this.createLink(linkBuilder);
  }

  /**
   * Pull a trace from a group.
   *
   * @param input the pullTrace input argument
   * @returns the Trace
   */
  public async pullTrace<TLinkData>(input: PullTransferInput<TLinkData>) {
    // retrieve parent link
    const parentLink = await this.getHeadLink(input);
    // extract info from input
    const { data } = input;

    // extract info from config
    const { workflowId, accountId, groupId, configId } = await this.getConfig();

    // use a TraceLinkBuilder to create the next link
    const linkBuilder = new TraceLinkBuilder<TLinkData>({
      // provide workflow id
      workflowId,
      // and wf config ID
      configId,
      // and parent link to append to the existing trace
      parentLink
    })
      // this is a pull transfer
      .forPullTransfer(groupId, data)
      // add creator info
      .withCreatedBy(accountId);

    // call createLink helper
    return this.createLink(linkBuilder);
  }

  /**
   * Accept a transfer of ownership
   *
   * @param input the acceptTransfer input argument
   * @returns the Trace
   */
  public async acceptTransfer<TLinkData>(
    input: TransferResponseInput<TLinkData>
  ) {
    // retrieve parent link
    const parentLink = await this.getHeadLink(input);
    // extract info from input
    const { data } = input;

    // extract info from config
    const { workflowId, accountId, groupId, configId } = await this.getConfig();

    // use a TraceLinkBuilder to create the next link
    const linkBuilder = new TraceLinkBuilder<TLinkData>({
      // provide workflow id
      workflowId,
      // and wf config ID
      configId,
      // and parent link to append to the existing trace
      parentLink
    })
      // this is to accept the transfer
      .forAcceptTransfer(data)
      // add group info
      .withGroup(groupId)
      // add creator info
      .withCreatedBy(accountId);

    // call createLink helper
    return this.createLink(linkBuilder);
  }

  /**
   * Reject a transfer of ownership
   *
   * @param input the rejectTransfer input argument
   * @returns the Trace
   */
  public async rejectTransfer<TLinkData>(
    input: TransferResponseInput<TLinkData>
  ) {
    // retrieve parent link
    const parentLink = await this.getHeadLink(input);

    // extract info from input
    const { data } = input;

    // extract info from config
    const { workflowId, accountId, configId } = await this.getConfig();

    // use a TraceLinkBuilder to create the next link
    const linkBuilder = new TraceLinkBuilder<TLinkData>({
      // provide workflow id
      workflowId,
      // and wf config ID
      configId,
      // and parent link to append to the existing trace
      parentLink
    })
      // this is to reject the transfer
      .forRejectTransfer(data)
      // add creator info
      .withCreatedBy(accountId);

    // call createLink helper
    return this.createLink(linkBuilder);
  }

  /**
   * Cancel a transfer of ownership
   *
   * @param input the cancelTransfer input argument
   * @returns the Trace
   */
  public async cancelTransfer<TLinkData>(
    input: TransferResponseInput<TLinkData>
  ) {
    // retrieve parent link
    const parentLink = await this.getHeadLink(input);

    // extract info from input
    const { data } = input;

    // extract info from config
    const { workflowId, accountId, configId } = await this.getConfig();

    // use a TraceLinkBuilder to create the next link
    const linkBuilder = new TraceLinkBuilder<TLinkData>({
      // provide workflow id
      workflowId,
      // and wf config ID
      configId,
      // and parent link to append to the existing trace
      parentLink
    })
      // this is to cancel the transfer
      .forCancelTransfer(data)
      // add creator info
      .withCreatedBy(accountId);

    // call createLink helper
    return this.createLink(linkBuilder);
  }

  /**
   * Get the state of a given trace.
   *
   * @param input the getTraceState input
   * @return the state of the trace
   */
  public async getTraceState(input: GetTraceStateInput) {
    // extract info from input
    const { traceId } = input;

    // shortcut types
    type Response = GetTraceStateQuery.Response;
    type Variables = GetTraceStateQuery.Variables;

    // execute graphql query
    const rsp = await this.client.graphql<Response, Variables>(
      GetTraceStateQuery.document,
      { traceId }
    );

    if (!rsp?.trace) {
      throw new Error(`Cannot find trace ${traceId}`);
    }

    // build and return the TraceState object
    return this.makeTraceState(rsp.trace);
  }

  /**
   * Get the details of a given trace.
   *
   * @param input the getTraceDetails input
   * @return the trace details
   */
  public async getTraceDetails(input: GetTraceDetailsInput) {
    // shortcut types
    type Response = GetTraceDetailsQuery.Response;
    type Variables = GetTraceDetailsQuery.Variables;

    // execute graphql query
    const rsp = await this.client.graphql<Response, Variables>(
      GetTraceDetailsQuery.document,
      input
    );

    // construct the link objects from raw responses
    const links = rsp.trace.links.nodes.map(l => fromObject(l.raw, l.data));

    // get pagination related info from response
    const { info, totalCount } = rsp.trace.links;

    // the details response object
    const details: TraceDetails = {
      links,
      totalCount,
      info
    };

    // return details result
    return details;
  }

  /**
   * Get the incoming traces.
   *
   * @param paginationInfo the pagination info
   * @return the incoming traces
   */
  public async getIncomingTraces(paginationInfo: PaginationInfo) {
    return this.getTracesInStage('INCOMING', paginationInfo);
  }

  /**
   * Get the outgoing traces.
   *
   * @param paginationInfo the pagination info
   * @return the outgoing traces
   */
  public async getOutgoingTraces(paginationInfo: PaginationInfo) {
    return this.getTracesInStage('OUTGOING', paginationInfo);
  }

  /**
   * Get the backlog traces.
   *
   * @param paginationInfo the pagination info
   * @return the backlog traces
   */
  public async getBacklogTraces(paginationInfo: PaginationInfo) {
    return this.getTracesInStage('BACKLOG', paginationInfo);
  }

  /**
   * Get the traces in a given attestation stage.
   *
   * @param paginationInfo the pagination info
   * @return the backlog traces
   */
  public async getAttestationTraces(
    actionKey: string,
    paginationInfo: PaginationInfo
  ) {
    return this.getTracesInStage('ATTESTATION', paginationInfo, actionKey);
  }

  /**
   * Search all the traces of the workflow
   */
  public async searchTraces(
    filter: SearchTracesFilter,
    paginationInfo: PaginationInfo
  ) {
    // shortcut types
    type Response = SearchTracesQuery.Response;
    type Variables = SearchTracesQuery.Variables;

    // extract info from config
    const { workflowId } = await this.getConfig();

    // create variables
    const variables: Variables = {
      workflowId,
      filter,
      ...paginationInfo
    };

    // execute graphql query
    const rsp = await this.client.graphql<Response, Variables>(
      SearchTracesQuery.document,
      variables
    );

    // extract traces response and pagination
    const { nodes, info, totalCount } = rsp.workflow.traces;

    // constructs result
    const res: TracesState<TState> = {
      traces: nodes.map(this.makeTraceState),
      info,
      totalCount
    };

    // return result
    return res;
  }

  /**
   * Extract, download and replace all file records in a data object.
   *
   * @param data the data that contains file records to download
   */
  public async downloadFilesInObject<TData>(data: TData) {
    // extract file records and corresponding paths
    const {
      idToObjectMap: idToFileRecordMap,
      pathToIdMap
    } = extractFileRecords(data);

    // download files and retrieve file wrappers
    const idToFileWrapperMap = await this.downloadFiles(idToFileRecordMap);

    // assign file wrappers back in data
    return assignObjects<FileRecord, FileWrapper, TData>(
      data,
      pathToIdMap,
      idToFileWrapperMap
    );
  }
}
