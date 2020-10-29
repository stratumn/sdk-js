import {
  TraceLinkMetaData,
  TraceActionType,
  TraceLinkType,
  MediaRecord,
  FileInfo
} from '../types';
import { FileWrapper } from '../fileWrapper';
import { FileRecord } from '../fileRecord';
import { ConfigQuery, CreateLinkMutation } from '../graphql';

export namespace fixtures {
  export namespace signingKey {
    export const pemPrivateKey = `
    -----BEGIN ED25519 PRIVATE KEY-----
    MFACAQAwBwYDK2VwBQAEQgRA3YYGIIAg4D7hsT5bXYE/OZsZrOon3h2u5R4ugDC1
    gjwSP9BQ2Dx7GyfNr8QX5fp695xnBr53x9i6YJCrLtWS8A==
    -----END ED25519 PRIVATE KEY-----
    `;

    export const pemPublicKey = `
    -----BEGIN ED25519 PUBLIC KEY-----
    MCowBQYDK2VwAyEAEj/QUNg8exsnza/EF+X6evecZwa+d8fYumCQqy7VkvA=
    -----END ED25519 PUBLIC KEY-----
    `;
  }

  export namespace traceLink {
    export interface Example {
      some: string;
      for: string;
    }
    export const workflowId = '184475';
    export const traceId = '34c14147-eafd-4956-b46c-1ea4b9976af0';
    export const data = { some: 'data', for: 'the people' };
    export const hashedData = {
      algo: 'sha256',
      hash: 'TnMst2eIwhyU7yg2izAItAyOOOrZgZDDmbRQ4G9rSqA='
    };
    export const type: TraceLinkType = 'OWNED';
    export const configId = '666';
    export const groupId = '877';
    export const actionKey = 'action zou';
    export const lastFormId = '325';
    export const inputs = ['47'];
    export const action: TraceActionType = '_ATTESTATION_';
    export const createdAt = new Date('2019-06-26T10:13:43.873Z');
    export const createdById = '195587';
    export const metadata: TraceLinkMetaData = {
      configId,
      groupId,
      formId: actionKey,
      lastFormId,
      inputs,
      createdAt,
      createdById
    };
  }

  const fileObj: MediaRecord & FileInfo = {
    digest: 'abc123',
    mimetype: 'text/plain',
    name: 'data.txt',
    size: 123
  };

  export namespace FileWrappers {
    export const obj = fileObj;
    export const nodeJsFilePath: FileWrapper = FileWrapper.fromNodeJsFilePath(
      'src/fixtures/stratumn.png'
    );
    export const nodeJsFileBlob: FileWrapper = FileWrapper.fromNodeJsFileBlob(
      Buffer.from('my data'),
      fileObj
    );
    /**
     * We wrap the creation of BrowserFile fixture
     * in a function as the execution of `new File` below
     * is platform dependent. Only tests that run in the jsdom
     * test env will be able to call that function.
     */
    export const makeBrowserFile = (): FileWrapper =>
      FileWrapper.fromBrowserFile(
        new File(['my text file...'], 'novel.txt', { type: 'txt' })
      );
  }
  export namespace FileRecords {
    export const obj = fileObj;
    export const fileRecord = FileRecord.fromObject(fileObj);
  }

  export namespace Sdk {
    export const workflowId = traceLink.workflowId;
    export const configQueryRsp: ConfigQuery.Response = {
      account: {
        userId: '117',
        accountId: '225',
        memberOf: {
          nodes: [{ accountId: '123' }]
        },
        account: {
          signingKey: {
            privateKey: {
              decrypted: signingKey.pemPrivateKey,
              passwordProtected: false
            }
          }
        }
      },
      workflow: {
        config: { id: '666' },
        groups: {
          nodes: [
            {
              groupId: '887',
              members: { nodes: [{ accountId: '123' }] }
            }
          ]
        }
      }
    };
    export const createLinkMutationImpl = (
      variables: CreateLinkMutation.Variables
    ) => {
      const createLinkMutationRsp: CreateLinkMutation.Response = {
        createLink: {
          trace: {
            head: {
              data: variables.data,
              raw: variables.link
            },
            state: {
              data: {}
            },
            updatedAt: new Date().toString()
          }
        }
      };
      return createLinkMutationRsp;
    };
  }
}
