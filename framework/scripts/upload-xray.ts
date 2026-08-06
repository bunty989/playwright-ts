import path from 'node:path';

import {
  JiraXrayUploader
} from '../Xray Helper/jiraXrayUploader_old';

import type {
  JiraXrayUploaderConfig
} from '../Xray Helper/jiraXrayUploader_old';

const root =
  process.cwd();

const workingDirectory =
  path.join(
    root,
    '.xray-upload'
  );

const pipelineId =
  process.env.CI_PIPELINE_ID ??
  'local';

const batchSizeMB =
  Number(
    process.env.XRAY_BATCH_SIZE_MB ??
    '25'
  );

/*
 * ----------------------------------------------------------
 * JIRA INFO.JSON FIELDS
 * ----------------------------------------------------------
 *
 * Put the same Jira fields here that you previously supplied
 * in your curl info.json.
 *
 * The uploader automatically adds:
 *
 * labels: ["gitlab-pipeline-<CI_PIPELINE_ID>"]
 *
 * for idempotency.
 */

const jiraFields: Record<string, unknown> = {
  project: {
    key:
      process.env.XRAY_PROJECT_KEY ??
      ''
  },

  summary:
    process.env.XRAY_EXECUTION_SUMMARY ??
    `Automated Test Execution - Pipeline ${pipelineId}`

  /*
   * Add your existing Jira fields here.
   *
   * Examples:
   *
   * issuetype: {
   *   name: 'Test Execution'
   * },
   *
   * description:
   *   `GitLab Pipeline ${pipelineId}`,
   *
   * customfield_12345: '...',
   *
   * fixVersions: [
   *   {
   *     name: 'Release 1.0'
   *   }
   * ]
   */
};

const config: JiraXrayUploaderConfig = {
  jiraBaseUrl:
    (
      process.env.JIRA_BASE_URL ??
      ''
    ).replace(
      /\/$/,
      ''
    ),

  jiraPatToken:
    process.env.JIRA_PAT_TOKEN ??
    '',

  cfClientId:
    process.env.CF_Access_Client_Id ??
    '',

  cfClientSecret:
    process.env.CF_Access_Client_Secret ??
    '',

  projectKey:
    process.env.XRAY_PROJECT_KEY ??
    '',

  reportPath:
    process.env.XRAY_REPORT_PATH ??
    path.join(
      root,
      'logs',
      'cucumber-report.json'
    ),

  workingDirectory,

  statePath:
    path.join(
      workingDirectory,
      'state.json'
    ),

  batchSizeBytes:
    batchSizeMB *
    1024 *
    1024,

  maxTestsPerBatch:
  Number(
    process.env.XRAY_BATCH_MAX_TESTS ??
    '100'
  ),

  maxRetries:
    Number(
      process.env.XRAY_MAX_RETRIES ??
      '3'
    ),

  retryDelayMs:
    Number(
      process.env.XRAY_RETRY_DELAY_MS ??
      '10000'
    ),

  requestTimeoutMs:
    Number(
      process.env.XRAY_REQUEST_TIMEOUT_MS ??
      '300000'
    ),

  pipelineId,

  executionSummary:
    process.env.XRAY_EXECUTION_SUMMARY ??
    `Automated Test Execution - Pipeline ${pipelineId}`,

  jiraFields
};

async function main(): Promise<void> {
  try {
    const uploader =
      new JiraXrayUploader(
        config
      );

    await uploader.run();

    process.exitCode =
      0;
  } catch (error) {
    console.error('');
    console.error('============================================');
    console.error('XRAY UPLOAD FAILED');
    console.error('============================================');

    if (
      error instanceof Error
    ) {
      console.error(
        error.stack ??
        error.message
      );
    } else {
      console.error(
        error
      );
    }

    process.exitCode =
      1;
  }
}

await main();