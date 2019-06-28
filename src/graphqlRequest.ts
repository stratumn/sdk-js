import { GraphQLClient } from 'graphql-request';
import { Variables } from 'graphql-request/dist/src/types';

// a small wrapper around GrapqhQLClient to simplify testing and mocking!
export default <T>(
  url: string,
  auth: string,
  query: string,
  variables?: Variables
) =>
  new GraphQLClient(url)
    .setHeader('Authorization', auth)
    .request<T>(query, variables);
