import { sig } from '@stratumn/js-crypto';
import { ISdkConfig } from './types/sdk';

export class SdkConfig implements ISdkConfig {
  workflowId: string;
  configId: string;
  accountId: string;
  groupLabel: string | undefined;
  groupLabelToIdMap: Record<string, string>;
  signingPrivateKey: sig.SigningPrivateKey;

  constructor(
    workflowId: string,
    configId: string,
    accountId: string,
    groupLabelToIdMap: Record<string, string>,
    signingPrivateKey: sig.SigningPrivateKey
  ) {
    this.workflowId = workflowId;
    this.configId = configId;
    this.accountId = accountId;
    this.groupLabelToIdMap = groupLabelToIdMap;
    this.signingPrivateKey = signingPrivateKey;
  }

  /**
   * The id of the group under which the trace is.
   *
   * @returns the group id
   */
  groupId(groupLabel?: string) {
    return this.getGroupIdByLabel(groupLabel || null);
  }

  private getGroupIdByLabel(groupLabelParam: string | null): string {
    let resultGroupId: string | null = null;
    const groupLabelToIdMapSize = Object.keys(this.groupLabelToIdMap).length;
    if (this.groupLabelToIdMap && 0 < groupLabelToIdMapSize) {
      if (null == groupLabelParam) {
        if (groupLabelToIdMapSize === 1) {
          // return the id of the only element
          const [firstId] = Object.keys(this.groupLabelToIdMap);
          resultGroupId = this.groupLabelToIdMap[firstId];
        } else if (groupLabelToIdMapSize > 1) {
          // Last check if groupId has been set manually
          if (this.groupLabel && this.groupLabelToIdMap[this.groupLabel]) {
            resultGroupId = this.groupLabelToIdMap[this.groupLabel];
          } else {
            throw new Error(
              'Multiple groups to select from, please specify the group label you wish to perform the action with.'
            );
          }
        }
      } else {
        resultGroupId = this.groupLabelToIdMap[groupLabelParam];
      }
    }

    if (!resultGroupId) {
      throw new Error(
        'No group to select from. At least one group is required to perform an action.'
      );
    }

    return resultGroupId;
  }
}
