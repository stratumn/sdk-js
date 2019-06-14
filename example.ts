import { Sdk } from './interface';

interface MyState {
  name: string;
  address: string;
  files: File[];
}

const main = async () => {
  // instantiate a new Sdk
  const sdk = new Sdk<MyState>({
    endpoints: 'staging',
    workflowId: '147',
    secret: { privateKey: '< SIGNING PRIVATE KEY GOES HERE >' }
  });

  // create a new trace using form 42
  const initState = await sdk.newTrace({
    formId: '42',
    data: { ok: 'roger' }
  });

  const { traceId } = initState;

  // append a new segment using form 43 (using files)
  const someFiles: File[] = [
    /* files go here */
  ];
  let nextState = await sdk.appendLink({
    traceId,
    formId: '43',
    prevLinkHash: initState.headLinkHash,
    data: { some: 'data', files: someFiles }
  });

  // push the trace to your friend 999
  nextState = await sdk.pushTrace({
    traceId,
    recipient: '999',
    prevLinkHash: nextState.headLinkHash,
    data: { for: 'you my friend' }
  });

  // get the state of another trace
  const otherState = await sdk.getTraceState({ traceId: 'other trace id' });

  // retrieves the files in the state
  // someOtherFiles has type File[] thanks to Sdk generics
  const { files: someOtherFiles } = otherState.data;

  // and do work on it
  const modifiedState = await sdk.appendLink({
    traceId: otherState.traceId,
    formId: '42',
    data: { ok: 'federer' },
    prevLinkHash: otherState.headLinkHash
  });
};
