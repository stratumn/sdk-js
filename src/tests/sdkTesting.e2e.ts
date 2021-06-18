/**
 * @jest-environment jsdom
 */
import { Sdk } from '../sdk';
import { FileWrapper } from '../fileWrapper';

const getEnvVariable = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Env variable ${key} has not been set.`);
  }
  return value;
};

const COMMENT_ACTION_KEY = 'comment';
const INIT_ACTION_KEY = 'init';
const UPLOAD_DOCUMENTS_ACTION_KEY = 'uploadDocuments';
const IMPORT_TA_ACTION_KEY = 'importTa';
const MY_GROUP_LABEL = 'group1';
const OTHER_GROUP_LABEL = 'group2';
const OTHER_GROUP_NAME = 'SDKs Group 2';

const [
  traceApiUrl,
  accountApiUrl,
  mediaApiUrl,
  workflowId,
  traceId,
  group1Id,
  group2Id,
  bot1Key,
  bot2Key
] = [
  'TRACE_API_URL',
  'ACCOUNT_API_URL',
  'MEDIA_API_URL',
  'WORKFLOW_ID',
  'TRACE_ID',
  'MY_GROUP',
  'OTHER_GROUP',
  'PEM_PRIVATEKEY',
  'PEM_PRIVATEKEY_2'
].map(getEnvVariable);

const endpoints = {
  account: accountApiUrl,
  media: mediaApiUrl,
  trace: traceApiUrl
};

it('sdk testing', async () => {
  const sdkBot1 = new Sdk({
    workflowId,
    endpoints,
    secret: { privateKey: bot1Key },
    groupLabel: MY_GROUP_LABEL
  });
  const sdkBot2 = new Sdk({
    workflowId,
    endpoints,
    secret: { privateKey: bot2Key },
    groupLabel: OTHER_GROUP_LABEL
  });

  const traceState = await sdkBot1.getTraceState({
    traceId
  });

  expect(traceId).toEqual(traceState.traceId);

  const traceDetails = await sdkBot1.getTraceDetails({
    traceId
  });
  expect(traceDetails.totalCount).toBeGreaterThan(0);

  const newtraceState = await sdkBot1.newTrace({
    actionKey: INIT_ACTION_KEY,
    data: {
      entity: OTHER_GROUP_NAME,
      submissionPeriod: '2021.Q4',
      startDate: '2021-01-30',
      deadline: '2021-06-30',
      comment: 'init comment'
    }
  });

  expect(newtraceState.traceId).not.toBeNull();
  expect(newtraceState.updatedByGroupId).toEqual(group1Id);

  const secondResponse = await sdkBot2.appendLink({
    formId: COMMENT_ACTION_KEY,
    traceId: newtraceState.traceId,
    data: {
      comment: 'comment'
    }
  });

  expect(secondResponse.updatedByGroupId).toEqual(group2Id);

  const testFile: FileWrapper = FileWrapper.fromNodeJsFilePath(
    'src/fixtures/TestFileX.txt'
  );

  const uploadResponse = await sdkBot2.appendLink({
    formId: UPLOAD_DOCUMENTS_ACTION_KEY,
    traceId: secondResponse.traceId,
    data: {
      documents: [testFile]
    }
  });

  expect(uploadResponse.traceId).not.toBeNull();
  const { documents } = uploadResponse.headLink.formData();
  expect(documents).toHaveLength(1);
  expect(documents).toEqual([
    {
      digest: expect.any(String),
      key: expect.any(String),
      mimetype: 'text/plain',
      createdAt: expect.any(String),
      name: 'TestFileX.txt',
      size: expect.any(Number)
    }
  ]);
  const downloaded = await sdkBot2.downloadFilesInObject(
    uploadResponse.headLink.formData()
  );
  expect(downloaded.documents).toHaveLength(1);
  const decrypted = await downloaded.documents[0].decryptedData();
  expect(decrypted.toString()).toEqual('This is a test file');

  const uploadCsvResponse = await sdkBot1.appendLink({
    formId: IMPORT_TA_ACTION_KEY,
    traceId: uploadResponse.traceId,
    data: {
      taSummary: [
        {
          reference: 'reference',
          entityName: 'entity',
          currency: 'EUR',
          amount: 500,
          endDate: '2020-06-25'
        },
        {
          reference: 'reference 2',
          entityName: 'entity 2',
          currency: 'EUR',
          amount: 1300,
          endDate: '2020-06-28'
        }
      ],
      file: FileWrapper.fromNodeJsFilePath('src/fixtures/TA.csv')
    }
  });

  expect(uploadCsvResponse.data.file).not.toBeNull();

  const addTagsState = await sdkBot1.addTagsToTrace({
    traceId,
    tags: ['tag1', 'tag2']
  });
  expect(addTagsState.tags).toContain('tag1');

  const searchResults = await sdkBot1.searchTraces(
    { tags: { contains: ['tag1', 'tag2'] } },
    {}
  );
  expect(searchResults.totalCount).toEqual(1);
}, 90000); // set custom timeout of 90 seconds as this test can take a long time to run
