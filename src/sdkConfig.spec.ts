import { sig } from '@stratumn/js-crypto';
import { SdkConfig } from './sdkConfig';
import { fixtures } from './fixtures';

describe('SdkConfig', () => {
  let config: SdkConfig;
  let groupLabelToIdMap: { [key: string]: string } = {};

  beforeEach(() => {
    const signingPrivateKey = new sig.SigningPrivateKey({
      pemPrivateKey: fixtures.signingKey.pemPrivateKey
    });

    // reset groupLabelToIdMap to have size 1
    groupLabelToIdMap = {
      [fixtures.traceLink.groupLabel]: fixtures.traceLink.groupId
    };

    config = new SdkConfig(
      fixtures.Sdk.workflowId,
      fixtures.traceLink.configId,
      fixtures.Sdk.configQueryRsp.account.accountId,
      groupLabelToIdMap,
      signingPrivateKey
    );
  });

  it('Get group Label with parameter', () => {
    expect(config.groupId()).toEqual(fixtures.traceLink.groupId);

    // size = 2
    fixtures.Sdk.configQueryRsp.workflow.groups.nodes.forEach(e => {
      groupLabelToIdMap[e.label] = e.groupId;
    });
    expect(Object.keys(groupLabelToIdMap).length).toEqual(2);

    // should throw error if no param and size > 1
    expect(() => {
      config.groupId();
    }).toThrow();

    // simulate config beeing updated in the getConfig function
    config.groupLabel = fixtures.traceLink.groupLabel;
    expect(config.groupId()).toEqual(fixtures.traceLink.groupId);
  });

  it('Get group Label with parameter', () => {
    // should throw error if label not found
    expect(() => {
      config.groupId('notExistingGroupLabel');
    }).toThrow();

    expect(config.groupId(fixtures.traceLink.groupLabel)).toEqual(
      fixtures.traceLink.groupId
    );
  });
});
