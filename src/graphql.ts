import gql from 'gql-tag';
import { SearchTracesFilter } from './types';

/**
 * The Fragments namespace contains various fragments
 * that are used thoughout the queries and mutations below.
 */
export namespace Fragments {
  /**
   * The HeadLink fragment
   */
  export namespace HeadLink {
    export const document = gql`
      fragment HeadLinkFragment on Trace {
        head {
          raw
          data
          groupId
        }
      }
    `;

    export interface Response {
      head: {
        raw: any;
        data?: any;
        groupId: string;
      };
    }
  }

  /**
   * The TraceState fragment
   */
  export namespace TraceState {
    export const document = gql`
      fragment TraceStateFragment on Trace {
        updatedAt
        state {
          data
        }
        head {
          raw
          data
          groupId
        }
        tags
        # TODO: temporary, remove once state computation
        # is handled server side
        links {
          nodes {
            raw
            data
          }
        }
      }
    `;

    export interface Response {
      updatedAt: string;
      state: {
        data: any;
      };
      head: {
        raw: any;
        data?: any;
        groupId: string;
      };
      tags?: string[];
    }
  }

  /**
   * The PaginationInfo fragments.
   * One for TracesConnection and one for LinksConnection.
   */
  export namespace PaginationInfo {
    export namespace OnTracesConnection {
      export const document = gql`
        fragment PaginationInfoOnTracesConnectionFragment on TracesConnection {
          totalCount
          info: pageInfo {
            hasNext: hasNextPage
            hasPrevious: hasPreviousPage
            startCursor
            endCursor
          }
        }
      `;
    }

    export namespace OnLinksConnection {
      export const document = gql`
        fragment PaginationInfoOnLinksConnectionFragment on LinksConnection {
          totalCount
          info: pageInfo {
            hasNext: hasNextPage
            hasPrevious: hasPreviousPage
            startCursor
            endCursor
          }
        }
      `;
    }

    export interface Variables {
      first?: number;
      last?: number;
      before?: string;
      after?: string;
    }

    export interface Response {
      totalCount: number;
      info: {
        hasNext: boolean;
        hasPrevious: boolean;
        startCursor?: string;
        endCursor?: string;
      };
    }
  }
}

/**
 * Below is a collection of namespaces that each contain:
 * - a document (string) corresponding to the graphql query / mutation
 * - an interface Response describing the expected reponse type for the request
 * - an optional interface Variables describing the expected variables type
 */

/**
 * ConfigQuery namespace, used to config the Sdk for a given workflow
 */
export namespace ConfigQuery {
  export const document = gql`
    query configQuery($workflowId: BigInt!) {
      account: myAccount {
        accountId: rowId
        signingKey {
          privateKey {
            passwordProtected
            decrypted
          }
        }
        bot {
          teams {
            nodes {
              accountId
            }
          }
        }
        user {
          memberOf {
            nodes {
              accountId: rowId
            }
          }
        }
      }
      workflow: workflowByRowId(rowId: $workflowId) {
        config {
          id: rowId
        }
        groups {
          nodes {
            groupId: rowId
            label
            members {
              nodes {
                accountId
              }
            }
          }
        }
      }
    }
  `;

  export interface Variables {
    workflowId: string;
  }

  export interface Response {
    account: {
      accountId: string;
      signingKey: {
        privateKey: {
          decrypted: string;
          passwordProtected: boolean;
        };
      } | null;
      bot: {
        teams: {
          nodes: {
            accountId: string;
          }[];
        };
      } | null;
      user: {
        memberOf: {
          nodes: {
            accountId: string;
          }[];
        };
      } | null;
    };
    workflow: {
      config: { id: string };
      groups: {
        nodes: {
          groupId: string;
          label: string;
          members: { nodes: { accountId: string }[] };
        }[];
      };
    };
  }
}

/**
 * CreateLinkMutation namespace, used when creating a new trace,
 * appending a link, pushing, pulling etc..
 */
export namespace CreateLinkMutation {
  export const document = gql`
    mutation createLinkMutation($link: JSON!, $data: JSON) {
      createLink(input: { link: $link, data: $data }) {
        trace {
          ...TraceStateFragment
        }
      }
    }
    ${Fragments.TraceState.document}
  `;

  export interface Variables {
    link: any;
    data?: any;
    groupId: string;
  }

  export interface Response {
    createLink: {
      trace: Fragments.TraceState.Response;
    };
  }
}

/**
 * GetHeadLinkQuery namespace, used before appending
 * a new link to get the current head of the trace.
 */
export namespace GetHeadLinkQuery {
  export const document = gql`
    query getHeadLinkQuery($traceId: UUID!) {
      trace: traceById(id: $traceId) {
        ...HeadLinkFragment
      }
    }
    ${Fragments.HeadLink.document}
  `;

  export interface Variables {
    traceId: string;
  }

  export interface Response {
    trace: Fragments.HeadLink.Response;
  }
}

/**
 * GetTraceStateQuery namespace, used to get the state
 * of a given trace.
 */
export namespace GetTraceStateQuery {
  export const document = gql`
    query getTraceStateQuery($traceId: UUID!) {
      trace: traceById(id: $traceId) {
        ...TraceStateFragment
      }
    }
    ${Fragments.TraceState.document}
  `;

  export interface Variables {
    traceId: string;
  }

  export interface Response {
    trace: Fragments.TraceState.Response;
  }
}

/**
 * GetTraceDetailsQuery namespace, used to get the details
 * of a given trace.
 */
export namespace GetTraceDetailsQuery {
  export const document = gql`
    query getTraceDetailsQuery(
      $traceId: UUID!
      $first: Int
      $last: Int
      $before: Cursor
      $after: Cursor
    ) {
      trace: traceById(id: $traceId) {
        links(first: $first, last: $last, before: $before, after: $after) {
          nodes {
            raw
            data
          }
          ...PaginationInfoOnLinksConnectionFragment
        }
      }
    }
    ${Fragments.PaginationInfo.OnLinksConnection.document}
  `;

  export interface Variables extends Fragments.PaginationInfo.Variables {
    traceId: string;
  }

  export interface Response {
    trace: {
      links: {
        nodes: {
          raw: any;
          data?: any;
        }[];
      } & Fragments.PaginationInfo.Response;
    };
  }
}

/**
 * GetTracesInStageQuery namespace, used to get all
 * the traces in a given stage (ie INCOMING, OUTGOING etc..)
 */
export namespace GetTracesInStageQuery {
  export const document = gql`
    query getTracesInStageQuery(
      $groupId: BigInt!
      $stageType: StageType!
      $actionKey: String
      $first: Int
      $last: Int
      $before: Cursor
      $after: Cursor
    ) {
      group: groupByRowId(rowId: $groupId) {
        stages(condition: { type: $stageType, actionKey: $actionKey }) {
          nodes {
            traces(first: $first, last: $last, before: $before, after: $after) {
              nodes {
                ...TraceStateFragment
              }
              ...PaginationInfoOnTracesConnectionFragment
            }
          }
        }
      }
    }
    ${Fragments.TraceState.document}
    ${Fragments.PaginationInfo.OnTracesConnection.document}
  `;

  export interface Variables extends Fragments.PaginationInfo.Variables {
    groupId: string;
    stageType: string;
    actionKey?: string;
  }

  export interface Response {
    group: {
      stages: {
        nodes: {
          traces: {
            nodes: Fragments.TraceState.Response[];
          } & Fragments.PaginationInfo.Response;
        }[];
      };
    };
  }
}

/**
 * AddTagsToTraceMutation namespace
 */
export namespace AddTagsToTraceMutation {
  export const document = gql`
    mutation addTagsToTraceMutation($traceId: UUID!, $tags: [String]!) {
      addTagsToTrace(input: { traceRowId: $traceId, tags: $tags }) {
        trace {
          ...TraceStateFragment
        }
      }
    }
    ${Fragments.TraceState.document}
  `;

  export interface Variables {
    traceId: string;
    tags: string[];
  }

  export interface Response {
    addTagsToTrace: {
      trace: Fragments.TraceState.Response;
    };
  }
}

/**
 * SearchTracesQuery namespace
 */
export namespace SearchTracesQuery {
  export const document = gql`
    query searchTracesQuery(
      $workflowId: BigInt!
      $first: Int
      $last: Int
      $before: Cursor
      $after: Cursor
      $filter: TraceFilter!
    ) {
      workflow: workflowByRowId(rowId: $workflowId) {
        traces(
          first: $first
          last: $last
          before: $before
          after: $after
          filter: $filter
        ) {
          nodes {
            ...TraceStateFragment
          }
          ...PaginationInfoOnTracesConnectionFragment
        }
      }
    }
    ${Fragments.TraceState.document}
    ${Fragments.PaginationInfo.OnTracesConnection.document}
  `;

  export interface Variables extends Fragments.PaginationInfo.Variables {
    workflowId: string;
    filter: SearchTracesFilter;
  }

  export interface Response {
    workflow: {
      traces: {
        nodes: Fragments.TraceState.Response[];
      } & Fragments.PaginationInfo.Response;
    };
  }
}
