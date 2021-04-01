import { mocked } from 'ts-jest/utils';
import uuid from 'uuid/v4';
import { TraceLinkBuilder } from './traceLinkBuilder';
import { fixtures } from './fixtures';
import { TraceActionType, TraceLinkType } from './types';
import { TraceLink } from './traceLink';

jest.mock('uuid/v4');
const mockUuid = mocked(uuid);

describe('TraceLinkBuilder', () => {
  type Example = fixtures.traceLink.Example;
  const {
    workflowId,
    configId,
    traceId,
    data,
    hashedData,
    groupId,
    actionKey,
    inputs,
    createdByAccountId
  } = fixtures.traceLink;

  let builder: TraceLinkBuilder<Example>;
  let parentLink: TraceLink<Example>;
  let builderWithParent: TraceLinkBuilder<Example>;

  beforeEach(() => {
    mockUuid.mockReturnValue(traceId as any);
    builder = new TraceLinkBuilder({ workflowId, configId })
      .forAttestation(actionKey, data)
      .withGroup(groupId)
      .withCreatedBy(createdByAccountId);
    parentLink = builder.build();
    builderWithParent = new TraceLinkBuilder({
      workflowId,
      configId,
      parentLink
    });
  });

  it('constructs without parent', () => {
    const link = builder.build();
    expect(link.workflowId()).toEqual(workflowId);
    expect(link.traceId()).toEqual(traceId);
    expect(link.outDegree()).toEqual(1);
    expect(link.priority()).toEqual(1);
    expect(link.createdAt()).toBeInstanceOf(Date);
    expect(link.prevLinkHash().toString()).toEqual('');
  });

  it('constructs with parent link', () => {
    const link = builderWithParent.build();
    expect(link.workflowId()).toEqual(workflowId);
    expect(link.traceId()).toEqual(traceId);
    expect(link.outDegree()).toEqual(1);
    expect(link.priority()).toEqual(2);
    expect(link.createdAt()).toBeInstanceOf(Date);
    expect(link.prevLinkHash()).toEqual(parentLink.hash());
  });

  it('forAttestation', () => {
    const link = builder.build();
    const expectedAction: string = 'action zou';
    const expectedType: TraceLinkType = 'OWNED';
    expect(link.formData()).toEqual(data);
    expect(link.data()).toEqual(hashedData);
    expect(link.action()).toEqual(expectedAction);
    expect(link.type()).toEqual(expectedType);
    expect(link.group()).toEqual(groupId);
    expect(link.inputs()).toEqual(undefined);
    expect(link.lastForm()).toEqual(undefined);
  });

  it('forPushTransfer', () => {
    const link = builderWithParent.forPushTransfer(inputs[0], data).build();
    const expectedAction: TraceActionType = '_PUSH_OWNERSHIP_';
    const expectedType: TraceLinkType = 'PUSHING';
    expect(link.data()).toEqual(hashedData);
    expect(link.action()).toEqual(expectedAction);
    expect(link.type()).toEqual(expectedType);
    expect(link.group()).toEqual(parentLink.group());
    expect(link.inputs()).toEqual(inputs);
    expect(link.lastForm()).toEqual(parentLink.form());
  });

  it('forPullTransfer', () => {
    const link = builderWithParent.forPullTransfer(inputs[0], data).build();
    const expectedAction: TraceActionType = '_PULL_OWNERSHIP_';
    const expectedType: TraceLinkType = 'PULLING';
    expect(link.data()).toEqual(hashedData);
    expect(link.action()).toEqual(expectedAction);
    expect(link.type()).toEqual(expectedType);
    expect(link.group()).toEqual(parentLink.group());
    expect(link.inputs()).toEqual(inputs);
    expect(link.lastForm()).toEqual(parentLink.form());
  });

  it('forCancelTransfer', () => {
    const link = builderWithParent.forCancelTransfer(data).build();
    const expectedAction: TraceActionType = '_CANCEL_TRANSFER_';
    const expectedType: TraceLinkType = 'OWNED';
    expect(link.data()).toEqual(hashedData);
    expect(link.action()).toEqual(expectedAction);
    expect(link.type()).toEqual(expectedType);
    expect(link.group()).toEqual(parentLink.group());
    expect(link.inputs()).toEqual(undefined);
    expect(link.lastForm()).toEqual(undefined);
  });

  it('forRejectTransfer', () => {
    const link = builderWithParent.forRejectTransfer(data).build();
    const expectedAction: TraceActionType = '_REJECT_TRANSFER_';
    const expectedType: TraceLinkType = 'OWNED';
    expect(link.data()).toEqual(hashedData);
    expect(link.action()).toEqual(expectedAction);
    expect(link.type()).toEqual(expectedType);
    expect(link.group()).toEqual(parentLink.group());
    expect(link.inputs()).toEqual(undefined);
    expect(link.lastForm()).toEqual(undefined);
  });

  it('forAcceptTransfer', () => {
    const link = builderWithParent.forAcceptTransfer(data).build();
    const expectedAction: TraceActionType = '_ACCEPT_TRANSFER_';
    const expectedType: TraceLinkType = 'OWNED';
    expect(link.data()).toEqual(hashedData);
    expect(link.action()).toEqual(expectedAction);
    expect(link.type()).toEqual(expectedType);
    expect(link.group()).toEqual(undefined);
    expect(link.inputs()).toEqual(undefined);
    expect(link.lastForm()).toEqual(undefined);
  });

  it('throws if parent link has not been provided', () => {
    expect(() =>
      builder.forPushTransfer(inputs[0])
    ).toThrowErrorMatchingInlineSnapshot(`"Parent link must be provided"`);
    expect(() =>
      builder.forPullTransfer(inputs[0])
    ).toThrowErrorMatchingInlineSnapshot(`"Parent link must be provided"`);
    expect(() =>
      builder.forCancelTransfer()
    ).toThrowErrorMatchingInlineSnapshot(`"Parent link must be provided"`);
    expect(() =>
      builder.forRejectTransfer()
    ).toThrowErrorMatchingInlineSnapshot(`"Parent link must be provided"`);
    expect(() =>
      builder.forAcceptTransfer()
    ).toThrowErrorMatchingInlineSnapshot(`"Parent link must be provided"`);
  });
});
