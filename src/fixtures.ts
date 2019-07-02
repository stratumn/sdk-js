import { TraceLinkMetaData, TraceActionType, TraceLinkType } from './types';

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
    export const ownerId = '563';
    export const groupId = '877';
    export const formId = '326';
    export const lastFormId = '325';
    export const inputs = ['47'];
    export const action: TraceActionType = '_ATTESTATION_';
    export const createdAt = new Date('2019-06-26T10:13:43.873Z');
    export const createdById = '195587';
    export const metadata: TraceLinkMetaData = {
      ownerId,
      groupId,
      formId,
      lastFormId,
      inputs,
      createdAt,
      createdById
    };
  }
}
