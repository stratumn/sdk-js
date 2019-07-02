import { LinkBuilder } from '@stratumn/js-chainscript';
import { TraceLink, fromObject } from './traceLink';
import { fixtures } from './fixtures';

/**
 * The goal is to test the TraceLink class without using
 * the TraceLinkBuilder class. So we use a simple LinkBuilder
 * to help with the creation of the underlying link.
 */

describe('TraceLink', () => {
  type Example = fixtures.traceLink.Example;
  let tLink: TraceLink<Example>;
  const {
    workflowId,
    traceId,
    data,
    type,
    ownerId,
    groupId,
    formId,
    lastFormId,
    inputs,
    createdAt,
    createdById,
    metadata
  } = fixtures.traceLink;
  beforeAll(() => {
    const builder = new LinkBuilder(workflowId, traceId);
    builder
      .withData(data)
      .withProcessState(type)
      .withMetadata(metadata);
    const link = builder.build();
    tLink = new TraceLink(link);
  });

  it('getters', () => {
    expect(tLink.data()).toEqual(data);
    expect(tLink.traceId()).toEqual(traceId);
    expect(tLink.workflowId()).toEqual(workflowId);
    expect(tLink.type()).toEqual(type);
    expect(tLink.metadata()).toEqual(metadata);
    expect(tLink.createdBy()).toEqual(createdById);
    expect(tLink.createdAt()).toEqual(createdAt);
    expect(tLink.owner()).toEqual(ownerId);
    expect(tLink.group()).toEqual(groupId);
    expect(tLink.form()).toEqual(formId);
    expect(tLink.lastForm()).toEqual(lastFormId);
    expect(tLink.inputs()).toEqual(inputs);
  });

  it('fromObject', () => {
    const newtLink = fromObject(tLink.toObject());
    expect(newtLink).toBeInstanceOf(TraceLink);
    // check some props
    expect(newtLink.createdBy()).toEqual(createdById);
    expect(newtLink.createdAt()).toEqual(createdAt);
    expect(newtLink.owner()).toEqual(ownerId);
    expect(newtLink.group()).toEqual(groupId);
    expect(newtLink.form()).toEqual(formId);
  });
});
