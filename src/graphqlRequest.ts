import { GraphQLClient } from 'graphql-request';
import { Variables } from 'graphql-request/dist/src/types';

// a small wrapper around GrapqhQLClient to simplify testing and mocking!
export default <T>(
  url: string,
  auth: string,
  userAgent: string,
  query: string,
  variables?: Variables
) =>
  new GraphQLClient(url)
    .setHeader('Authorization', auth)
    .setHeader('User-Agent', userAgent)
    .request<T>(query, variables);
