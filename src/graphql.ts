import gql from 'gql-tag';

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
        }
      }
    `;

    export interface Response {
      head: {
        raw: Object;
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
        state
        head {
          raw
        }
      }
    `;

    export interface Response {
      updatedAt: string;
      state: any;
      head: {
        raw: Object;
      };
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
 * SetupQuery namespace, used to setup the Sdk for a given workflow
 */
export namespace SetupQuery {
  export const document = gql`
    query setupQuery($workflowId: BigInt!) {
      account: me {
        userId: rowId
        accountId
        account {
          signingKey {
            privateKey {
              passwordProtected
              decrypted
            }
          }
        }
        memberOf {
          nodes {
            accountId: rowId
          }
        }
      }
      workflow: workflowByRowId(rowId: $workflowId) {
        groups {
          nodes {
            groupId: rowId
            accountId: ownerId
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
      userId: string;
      accountId: string;
      account: {
        signingKey: {
          privateKey: {
            decrypted: string;
            passwordProtected: boolean;
          };
        };
      };
      memberOf: {
        nodes: {
          accountId: string;
        }[];
      };
    };
    workflow: {
      groups: {
        nodes: {
          groupId: string;
          accountId: string;
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
    mutation createLinkMutation($link: JSON!) {
      createLink(input: { link: $link }) {
        trace {
          ...TraceStateFragment
        }
      }
    }
    ${Fragments.TraceState.document}
  `;

  export interface Variables {
    link: Object;
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
          raw: Object;
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
      $first: Int
      $last: Int
      $before: Cursor
      $after: Cursor
    ) {
      group: groupByRowId(rowId: $groupId) {
        stages(condition: { type: $stageType }) {
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
