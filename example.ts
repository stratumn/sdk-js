import { Sdk } from './interface';

const main = async () => {
  // instantiate a new Sdk
  const sdk = new Sdk({
    endpoints: 'staging',
    workflowId: '147',
    secret: '< SIGNING PRIVATE KEY GOES HERE >'
  });

  // create a new trace using form 42
  const initState = await sdk.newTrace({
    formId: '42',
    data: { ok: 'roger' }
  });

  const traceId = initState.head.traceId();

  // append a new segment using form 43 (using files)
  const someFiles: File[] = [
    /* files go here */
  ];
  let nextState = await sdk.appendTrace({
    traceId,
    formId: '43',
    prevLinkHash: initState.head.prevLinkHash(),
    data: { some: 'data', files: someFiles }
  });

  // push the trace to your friend 999
  nextState = await sdk.transferTrace({
    traceId,
    recipient: '999',
    prevLinkHash: nextState.head.prevLinkHash(),
    data: { for: 'you my friend' }
  });

  // get the state of another trace
  const otherState = await sdk.getTraceState('other trace id');

  // retrieves the files in the head link
  const { files: someOtherFiles } = otherState.head.data();

  // and do work on it
  const modifiedState = await sdk.appendTrace({
    traceId: otherState.head.traceId(),
    formId: '42',
    data: { ok: 'federer' },
    prevLinkHash: otherState.head.prevLinkHash()
  });
};
