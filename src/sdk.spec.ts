/**
 * @jest-environment jsdom
 */
import { mocked } from 'ts-jest/utils';
import { Sdk } from './sdk';
import { Client } from './client';
import { fixtures } from './fixtures';

jest.mock('./client');
const mockClientCtor = mocked(Client);

describe('Sdk', () => {
  let sdk: Sdk;
  beforeEach(() => {
    mockClientCtor.mockClear();
    sdk = new Sdk({
      secret: {
        privateKey: fixtures.signingKey.pemPrivateKey
      },
      workflowId: fixtures.Sdk.workflowId
    });
  });

  it('instanciates a client', () => {
    expect(mockClientCtor).toHaveBeenCalledTimes(1);
  });

  it('concurrency', async () => {
    const mockClient = mocked(mockClientCtor.mock.instances[0]);
    const { configQueryRsp, createLinkMutationImpl } = fixtures.Sdk;
    const graphqlImpl = (query: string, variables: any) => {
      const trimmedQuery = query.trim();
      if (trimmedQuery.startsWith('query configQuery')) {
        return configQueryRsp;
      }
      if (trimmedQuery.startsWith('mutation createLinkMutation')) {
        return createLinkMutationImpl(variables);
      }
      throw new Error();
    };
    mockClient.graphql.mockImplementation(graphqlImpl as any);
    await Promise.all([
      sdk.newTrace({ formId: '42', data: {} }),
      sdk.newTrace({ formId: '43', data: {} }),
      sdk.newTrace({ formId: '44', data: {} }),
      sdk.newTrace({ formId: '45', data: {} })
    ]);
    expect(mockClient.graphql).toHaveBeenCalledTimes(5);
    expect(
      mockClient.graphql.mock.calls.map(([query]) => query.trim().split('(')[0])
    ).toEqual([
      'query configQuery',
      'mutation createLinkMutation',
      'mutation createLinkMutation',
      'mutation createLinkMutation',
      'mutation createLinkMutation'
    ]);
  });
});
