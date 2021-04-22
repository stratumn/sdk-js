/**
 * @jest-environment jsdom
 */
import uuid from 'uuid/v4';
import { Sdk } from '../sdk';
import { fixtures } from '../fixtures';

const getEnvVariable = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Env variable ${key} has not been set.`);
  }
  return value;
};

const [
  traceApiUrl,
  accountApiUrl,
  mediaApiUrl,
  workflowId,
  bot1Key,
  teamBId,
  bot2Email,
  bot2Password,
  formRequestId,
  formResponseId,
  group1Label,
  group2Label
] = [
  'TRACE_API_URL',
  'ACCOUNT_API_URL',
  'MEDIA_API_URL',
  'WORKFLOW_ID',
  'BOT_1_KEY',
  'TEAM_B_ID',
  'BOT_2_EMAIL',
  'BOT_2_PASSWORD',
  'FORM_REQUEST_ID',
  'FORM_RESPONSE_ID',
  'GROUP_1_LABEL',
  'GROUP_2_LABEL'
].map(getEnvVariable);

const endpoints = {
  account: accountApiUrl,
  media: mediaApiUrl,
  trace: traceApiUrl
};

it('continuous testing', async () => {
  const sdkBot1 = new Sdk({
    workflowId,
    endpoints,
    secret: { privateKey: bot1Key },
    groupLabel: group1Label
  });
  const sdkBot2 = new Sdk({
    workflowId,
    endpoints,
    secret: { email: bot2Email, password: bot2Password },
    groupLabel: group2Label
  });

  const numRequests = 3;
  const requestsBody = Array.from(Array(numRequests)).map(
    () => `request id: ${uuid()}`
  );
  const requests = await Promise.all(
    requestsBody.map(body =>
      sdkBot1.newTrace({
        actionKey: formRequestId,
        data: {
          body
        }
      })
    )
  );

  expect(requests).toHaveLength(numRequests);

  const [firstRequest, secondRequest, thirdRequest] = requests;

  const firstPush = await sdkBot1.pushTrace({
    traceId: firstRequest.traceId,
    recipient: teamBId
  });

  expect(firstPush.traceId).toBe(firstRequest.traceId);
  expect(firstPush.headLink.prevLinkHash()).toEqual(
    firstRequest.headLink.hash()
  );

  await sdkBot1.pushTrace({
    prevLink: secondRequest.headLink,
    recipient: teamBId
  });

  await sdkBot1.pushTrace({
    prevLink: thirdRequest.headLink,
    recipient: teamBId
  });

  const incoming = await sdkBot2.getIncomingTraces({ first: numRequests });
  expect(incoming.totalCount).toBeGreaterThanOrEqual(numRequests);
  expect(incoming.traces).toHaveLength(numRequests);
  expect(incoming.traces.map(t => t.traceId)).toEqual(
    expect.arrayContaining(requests.map(r => r.traceId))
  );

  await sdkBot2.acceptTransfer({ traceId: firstRequest.traceId });
  const backlog = await sdkBot2.getBacklogTraces({ first: 1 });
  expect(backlog.totalCount).toBeGreaterThanOrEqual(1);
  expect(backlog.traces[0].traceId).toEqual(firstRequest.traceId);

  await sdkBot2.acceptTransfer({ traceId: secondRequest.traceId });
  const { nodeJsFilePath, makeBrowserFile } = fixtures.FileWrappers;
  const browserFile = makeBrowserFile();
  const secondResponse = await sdkBot2.appendLink({
    formId: formResponseId,
    traceId: secondRequest.traceId,
    data: {
      status: '200',
      body: 'OK. Files attached.',
      attachments: [nodeJsFilePath, browserFile]
    }
  });
  const { attachments } = secondResponse.headLink.formData();
  expect(attachments).toHaveLength(2);
  expect(attachments).toEqual([
    {
      digest: expect.any(String),
      key: expect.any(String),
      mimetype: 'image/png',
      name: 'stratumn.png',
      size: expect.any(Number)
    },
    {
      digest: expect.any(String),
      key: expect.any(String),
      mimetype: 'txt',
      name: 'novel.txt',
      size: expect.any(Number)
    }
  ]);

  const downloaded = await sdkBot2.downloadFilesInObject(
    secondResponse.headLink.formData()
  );
  expect(downloaded.attachments).toHaveLength(2);
  const decrypted = await downloaded.attachments[1].decryptedData();
  const encrypted = await downloaded.attachments[1].encryptedData();
  expect(decrypted.toString()).toEqual('my text file...');
  expect(encrypted.toString()).not.toEqual('my text file...');

  const state = await sdkBot2.addTagsToTrace({
    traceId: firstRequest.traceId,
    tags: ['accepted', 'todo']
  });

  expect(state.tags).toEqual(['accepted', 'todo']);

  const searchResults = await sdkBot2.searchTraces(
    { tags: { overlaps: ['todo', 'other tag'] } },
    {}
  );

  expect(searchResults.totalCount).toBeGreaterThanOrEqual(1);
}, 90000); // set custom timeout of 90 seconds as this test can take a long time to run
