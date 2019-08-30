# Stratumn SDK for JavaScript [![npm version](https://badge.fury.io/js/%40stratumn%2Fsdk.svg)](https://badge.fury.io/js/%40stratumn%2Fsdk)

The official Stratumn SDK for JavaScript to interact with [Trace](https://trace.stratumn.com), available for Node.js backends.

## :satellite: Installing

### In Node.js

The preferred way to install the Stratumn SDK for Node.js is to use the
[yarn](http://yarnpkg.com) package manager for Node.js. Simply type the following
into a terminal window:

```sh
yarn add @stratumn/sdk
```

## :rocket: Usage and Getting Started

### Configuration

You must start by importing the `Sdk` class definition:

```js
var { Sdk } = require('@stratumn/sdk');
```

You can then create a new instance of the `Sdk`:

```js
var sdk = new Sdk({
  workflowId: YOUR_CONFIG.workflowId,
  secret: { privateKey: YOUR_SECRETS.privateKey }
});
```

You will need to provide:

- a valid workflow id that has been created via [Trace](https://trace.stratumn.com).
- a secret that will be used to authenticate via [Account](https://account.stratumn.com)

The authentication secret can be one of the following:

- a `CredentialSecret` object containing the email and password of the account
- a `PrivateKeySecret` object containing the signing private key of the account

Notes:

- You can find the workflow id in the url of your workflow. For example, when looking at `https://trace.stratumn.com/workflow/95572258`, the id is `95572258`.
- When a `PrivateKeySecret` is provided, a unique message is generated, signed and sent to [Account](https://account.stratumn.com) for validation. We check that the signature and the message are valid and return an authentication token in that case.
- By default the `Sdk` is configured to point to the production environment of Trace. During a development phase, you can configure the `Sdk` to point to the staging environment:

```js
var sdk = new Sdk({
  workflowId: YOUR_CONFIG.workflowId,
  secret: { privateKey: YOUR_SECRETS.privateKey },
  endpoints: {
    trace: 'https://trace-api.staging.stratumn.com',
    account: 'https://account-api.staging.stratumn.com',
    media: 'https://media-api.staging.stratumn.com'
  }
});
```

### Creating a new trace

You can create a new trace this way:

```js
let myFirstTrace = await sdk.newTrace({
  formId: YOUR_CONFIG.formNewShipment,
  data: {
    operation: 'new shipment XYZ for ABC',
    weight: 123,
    valid: true,
    operators: ['Ludovic K.', 'Bernard Q.']
  }
});
```

You must provide:

- `formId`: a valid form id,
- `data`: the data object corresponding to the action being done.

The Sdk will return an object corresponding to the "state" of your new trace. This state exposes the following fields:

- `traceId`: the id (uuid format) which uniquely identify the newly created trace,
- `headLink`: the link that was last appended to the trace,
- `updatedAt`: the `Date` at which the trace was last updated,
- `updatedBy`: the id of the user who last updated the trace,
- `data`: the aggregated data modelling the state the trace is in.

Notes:

- You can view your forms detail from your group's Attestation Forms page (for ex `https://trace.stratumn.com/group/322547/forms`).
- When viewing a specific form detail, you can retrieve the form id from the url. (`https://trace.stratumn.com/group/322547/form/788547` => `formId=788547`).
- The `data` object argument must be valid against the JSON schema of the form you are using, otherwise Trace will throw a validation error.
- Note that the return type of `sdk.newTrace` is `Promise<TraceState>` since this operation is asynchronous. You must `await` for the response in order to effectively use it.

### Appending a link to an existing trace

Assuming you have access to the head link of the trace you wish to append a link to (in this example it is `myFirstTrace.headLink`), you can proceed this way:

```js
await sdk.appendLink({
  prevLink: myFirstTrace.headLink,
  formId: YOUR_CONFIG.formDeparture,
  data: {
    operation: 'XYZ shipment departed port for ABC',
    destination: 'ABC',
    customsCheck: true,
    eta: '2019-07-02T12:00:00.000Z'
  }
});
```

If you don't have access to the head link, you can also provide the trace id:

```js
await sdk.appendLink({
  traceId: someTraceId,
  formId: YOUR_CONFIG.formDeparture,
  data: {
    ...
  }
});
```

You must provide:

- `formId`: a valid form id,
- `data`: the data object corresponding to the action being done,
- `prevLink` or `traceId`.

The Sdk will return the new state object of the trace. The shape of this object is the same as explained [previously](#creating-a-new-trace).

Notes:

- You can view your forms detail from your group's Attestation Forms page (for ex `https://trace.stratumn.com/group/322547/forms`).
- When viewing a specific form detail, you can retrieve the form id from the url. (`https://trace.stratumn.com/group/322547/form/788547` => `formId=788547`).
- The `data` object argument must be valid against the JSON schema of the form you are using, otherwise Trace will throw a validation error.

### Requesting the transfer of ownership of a trace

You can "push" the trace to another group in the workflow this way:

```js
await sdk.pushTrace({
  prevLink, // or traceId
  recipient: YOUR_CONFIG.otherGroup,
  data: {
    why: 'because'
  }
});
```

The arguments are:

- `recipient`: the id of the group to push the trace to,
- `data`: (optional) some data related to the push transfer,
- `prevLink` or `traceId`.

You can also "pull" an existing trace from another group:

```js
await sdk.pullTrace({
  prevLink, // or traceId
  data: {
    why: 'because'
  }
});
```

And in this case, the arguments are:

- `data`: (optional) some data related to the pull transfer,
- `prevLink` or `traceId`.

The Sdk will return the new state object of the trace. The shape of this object is the same as explained [previously](#creating-a-new-trace).

Notes:

- In both cases, the trace is not transferred automatically to or from the group. The recipient must respond to your request as we will see in the [next section](#responding-to-a-transfer-of-ownership-of-a-trace).
- You don't need to provide a `recipient` in the case of a `pullTransfer` since the two parties of the transfer can be inferred (you and the current owner of the trace).
- The `data` object argument is optional. When it is provided, it is a free form object that will not be validated against a JSON schema.

### Responding to a transfer of ownership of a trace

When someone pushed a trace to your group, you can either accept or reject the transfer:

```js
await sdk.acceptTransfer({
  prevLink // or traceId
});
```

Or:

```js
await sdk.rejectTransfer({
  prevLink, // or traceId
  data: {
    reason: 'no way!'
  }
});
```

Alternatively, if you have initiated the transfer (push or pull), you can also before it has been accepted:

```js
await sdk.cancelTransfer({
  prevLink // or traceId
});
```

In all cases, the arguments are:

- `data`: (optional) some data related to the pull transfer,
- `prevLink` or `traceId`.

The Sdk will return the new state object of the trace. The shape of this object is the same as explained [previously](#creating-a-new-trace).

Notes:

- The `data` object argument is optional. When it is provided, it is a free form object that will not be validated against a JSON schema.

### Trace stages

Your group in the workflow is composed of multiple stages. There are always 3 default stages:

- `Incoming`: this stage lists all the traces that are being transferred to your group (push or pull),
- `Backlog`: this stage lists all the traces that have been transferred to your group and accepted,
- `Outgoing`: this stage lists all the traces that are being transferred to another group (push or pull).

The other stages are called `Attestation` stages. They compose the logic of your group in the context of this workflow.

Notes:

- When someone pushes a trace to your group, it will appear in your `Incoming` stage and their `Outgoing` stage.
- When you accept a transfer, the trace will move to your `Backlog` stage.
- When you reject a transfer, the trace will move back to its previous `Attestation` stage and disappear from the `Outgoing` and `Incoming` stages it was in.

### Retrieving traces

When all you have is the id of a trace, you can get its state by calling:

```js
await sdk.getTraceState({
  traceId
});
```

The argument:

- `traceId`: the id of the trace

You can also retrieve the links of a given trace this way:

```js
await sdk.getTraceDetails({
  traceId,
  first: 5
});
```

In this case, we are asking for the first 5 links (see [pagination](#pagination)).

Arguments:

- `traceId`: the id of the trace,
- `first`: (optional) retrieve the first n elements,
- `after`: (optional) retrieve the elements after a certain point,
- `last`: (optional) retrieve the last n elements,
- `before`: (optional) retrieve the elements before a certain point.

For more explanation on how the pagination work, go to the dedication [section](#pagination).

The Sdk will return an object with the details about the trace you asked for. This object exposes the following fields:

- `links`: the paginated array of links,
- `totalCount`: the total number of links in the trace,
- `info`: a pagination object (more on this [here](#pagination)).

To retrieve all the traces of a given stage, you can:

```js
await sdk.getIncomingTraces({
  first: 10
});
```

Or:

```js
await sdk.getOutgoingTraces();
```

Or:

```js
await sdk.getBacklogTraces();
```

Arguments:

- `first`: (optional) retrieve the first n elements,
- `after`: (optional) retrieve the elements after a certain point,
- `last`: (optional) retrieve the last n elements,
- `before`: (optional) retrieve the elements before a certain point.

For more explanation on how the pagination work, go to the dedication [section](#pagination).

The Sdk will return an object with the traces currently in the given stage. This object exposes the following fields:

- `traces`: the paginated array of traces (trace states actually),
- `totalCount`: the total number of traces in the trace,
- `info`: a pagination object (more on this [here](#pagination)).

### Pagination

When a method returns an array of elements (traces, links, etc..), it will be paginated. It means that you can provide arguments to specify how many elements to retrieve from which point in the full list. The pagination arguments will always look like:

- `first`: (optional) retrieve the first n elements,
- `after`: (optional) retrieve the elements after a certain point,
- `last`: (optional) retrieve the last n elements,
- `before`: (optional) retrieve the elements before a certain point.

You must use `first` and/or `after` together, `last` and/or `before` together. If you try to retrieve the `first=n before=xyz` the Sdk will throw an error.

In the result object, you will have the `totalCount` and an `info` object that has the following fields:

- `hasNext`: a flag telling if there is a next series of elements to retrieve after this one,
- `hasPrevious`: a flag telling if there is a previous series of elements to retrieve before this one,
- `startCursor`: (optional) a cursor (string) representing the position of the first element in this series,
- `endCursor`: (optional) a cursor (string) representing the position of the last element in this series.

Let's look at a pagination example. We start by retrieving (and consuming) the first 10 incoming traces:

```js
let results = await sdk.getIncomingTraces({
  first: 10
});

consume(results.traces);
```

Next, we look at the pagination info results to know if there are more traces to retrieve:

```js
if (results.info.hasNext) {
  results = await sdk.getIncomingTraces({
    first: 10,
    after: results.info.endCursor
  });
  consume(results.traces);
}
```

In the case there are more traces to retrieve (`hasNext === true`), we call the `getIncomingTraces` method again setting the `after` argument to the `endCursor`. We keep doing this until `hasNext === false`.

Putting all this together, we can synthetize this in a loop:

```js
let results;
do {
  results = await sdk.getIncomingTraces({
    first: 10,
    after: results.info.endCursor
  });
  consume(results.traces);
} while (results.info.hasNext);
```

### :floppy_disk: Handling files

When providing a `data` object in an action (via `newTrace`, `appendLink` etc.), you can embed files that will automatically be uploaded and encrypted for you. We provide two ways for embedding files, depending on the platform your app is running.

In NodeJs, here is how you would do it:

```js
var { FileWrapper } = require('@stratumn/sdk');

var state = await sdk.appendLink({
  prevLink,
  formId,
  data: {
    operation: 'XYZ shipment departed port for ABC',
    destination: 'ABC',
    customsCheck: true,
    customsCertificates: [
      FileWrapper.fromNodeJsFilePath('/docs/certif_abc.pdf'),
      FileWrapper.fromNodeJsFilePath('/docs/pic_ea15qw.png')
    ],
    eta: '2019-07-02T12:00:00.000Z'
  }
});
```

In the browser, assuming you are working with `File` objects, you can use:

```js
var { FileWrapper } = require('@stratumn/sdk');

var state = await sdk.appendLink({
  prevLink,
  formId,
  data: {
    operation: 'XYZ shipment departed port for ABC',
    destination: 'ABC',
    customsCheck: true,
    customsCertificates: [
      FileWrapper.fromBrowserFile(certifFile),
      FileWrapper.fromBrowserFile(pictureFile)
    ],
    eta: '2019-07-02T12:00:00.000Z'
  }
});
```

Under the hood, all the files are encrypted and uploaded first and the `FileWrapper` objects found in the data object are converted to a `FileRecord` object, that will look like this:

```js
{
  mimetype: 'image/png',
  digest: '1114c7455d6365dc5431c0a1c1388088b793fd8bdec7',
  key: 'x/Qr55ABlruIU0E4FoE4iCP0tr4Y1EjCt6bb5iCaugs=',
  name: 'pic_ea15qw.png',
  size: 235899
}
```

This record uniquely identifies the corresponding file in our service and is easily serializable. If you look in the `headLink` of the returned state, you will see that the `FileWrapper` have been converted to `FileRecord` types:

```js
var data = state.headLink.formData();
console.log(data.customCertificates);

// will output:
// [
//   {
//     mimetype: 'application/pdf',
//     digest: '1114a1ec84cee50603eb285f2006c3b42279fd272d87',
//     key: 'flBg5AAQI/MBGZnXGYEfuwCEexgkCrD1sXPCYqWvjyc=',
//     name: 'certif_abc.pdf',
//     size: 86726
//   },
//   {
//     mimetype: 'image/png',
//     digest: '1114c7455d6365dc5431c0a1c1388088b793fd8bdec7',
//     key: 'x/Qr55ABlruIU0E4FoE4iCP0tr4Y1EjCt6bb5iCaugs=',
//     name: 'pic_ea15qw.png',
//     size: 235899
//   }
// ]
```

When you retrieve traces with the Sdk, it will not automatically download the files for you. You have to explicitely call a method on the Sdk for that purpose:

```js
var state = sdk.getTraceState({
  traceId: thePreviousTraceId
});

var dataWithRecords = state.headLink.formData();

var dataWithFiles = sdk.downloadFilesInObject(dataWithRecords);

var [certif, pic] = dataWithFiles.customCertificates;

consume(certif.decryptedData());
consume(pic.decryptedData());
```

In this case, `certif` and `pic` are `FileWrapper` objects from which you can extract the raw decrypted data (type `Buffer`).

## :loudspeaker: Getting Help

## :beetle: Opening Issues

## :handshake: Contributing

## :pencil: License

This SDK is distributed under the
[Apache License, Version 2.0](http://www.apache.org/licenses/LICENSE-2.0),
see LICENSE.txt for more information.
