import fs from 'node:fs';
import path from 'node:path';

import { parser } from 'stream-json';
import { streamArray } from 'stream-json/streamers/StreamArray';

// ==========================================================
// TYPES
// ==========================================================

interface CucumberElement {
  id?: string;
  keyword?: string;
  name?: string;
  type?: string;
  [key: string]: unknown;
}

interface CucumberFeature {
  uri?: string;
  id?: string;
  keyword?: string;
  name?: string;
  description?: string;
  line?: number;
  tags?: unknown[];
  elements?: CucumberElement[];
  [key: string]: unknown;
}

interface UploadState {
  pipelineId: string;
  testExecutionKey: string;
  lastSuccessfulBatch: number;
  createdAt: string;
  updatedAt: string;
}

interface XrayResponse {
  testExecIssue?: {
    id?: string;
    key?: string;
    self?: string;
  };

  key?: string;
  id?: string;

  [key: string]: unknown;
}

interface JiraSearchResponse {
  issues?: Array<{
    id: string;
    key: string;
    self?: string;
  }>;
}

interface HttpError extends Error {
  status?: number;
}

// ==========================================================
// CONFIG
// ==========================================================

export interface JiraXrayUploaderConfig {
  jiraBaseUrl: string;
  jiraPatToken: string;

  cfClientId: string;
  cfClientSecret: string;

  projectKey: string;

  reportPath: string;

  workingDirectory: string;
  statePath: string;

  /*
   * Maximum approximate JSON batch size.
   *
   * Recommended:
   * 2 MB
   */
  batchSizeBytes: number;

  /*
   * Maximum number of Cucumber scenarios/test results
   * per batch.
   *
   * Recommended:
   * 100
   */
  maxTestsPerBatch?: number;

  maxRetries: number;
  retryDelayMs: number;
  requestTimeoutMs: number;

  pipelineId: string;

  executionSummary: string;

  jiraFields: Record<string, unknown>;
}

// ==========================================================
// UPLOADER
// ==========================================================

export class JiraXrayUploader {
  private batchNumber = 0;

  private currentBatch: CucumberFeature[] = [];

  private currentBatchBytes = 2;

  private currentBatchTests = 0;

  private state?: UploadState;

  private totalFeatures = 0;

  private totalTests = 0;

  private totalBatches = 0;

  private readonly pipelineLabel: string;

  public constructor(
    private readonly config: JiraXrayUploaderConfig
  ) {
    this.pipelineLabel =
      `gitlab-pipeline-${config.pipelineId}`;
  }

  // ========================================================
  // RUN
  // ========================================================

  public async run(): Promise<void> {
    this.validate();

    this.prepareWorkingDirectory();

    this.printHeader();

    /*
     * Try local state first.
     */
    this.state =
      this.loadState();

    if (this.state) {
      this.logExistingState();
    } else {
      /*
       * No local state.
       *
       * Search Jira before creating anything.
       *
       * This prevents duplicate Test Executions when:
       *
       * - the GitLab job is retried
       * - Cloudflare previously returned 504
       * - the runner previously terminated
       */
      const existingExecution =
        await this.findExistingTestExecution();

      if (existingExecution) {
        console.log('');
        console.log(
          'Existing Test Execution found in Jira.'
        );

        console.log(
          `Test Execution : ${existingExecution}`
        );

        console.log(
          `Issue URL      : ${this.getIssueUrl(existingExecution)}`
        );

        this.createState(
          existingExecution,
          0
        );
      }
    }

    await this.streamAndUploadReport();

    if (!this.state?.testExecutionKey) {
      throw new Error(
        'Upload completed without obtaining an Xray Test Execution key.'
      );
    }

    this.printCompletionSummary();
  }

  // ========================================================
  // STREAM CUCUMBER REPORT
  // ========================================================

  private async streamAndUploadReport(): Promise<void> {
    console.log('');
    console.log(
      'Streaming Cucumber report...'
    );

    const source =
      fs.createReadStream(
        this.config.reportPath,
        {
          encoding: 'utf8',

          /*
           * Read 1 MB at a time.
           *
           * The entire cucumber-report.json is therefore
           * never loaded into memory.
           */
          highWaterMark:
            1024 * 1024
        }
      );

    const jsonParser =
      parser();

    const arrayStreamer =
      streamArray();

    source
      .pipe(jsonParser)
      .pipe(arrayStreamer);

    await new Promise<void>(
      (resolve, reject) => {
        let processing: Promise<void> =
          Promise.resolve();

        let settled =
          false;

        const fail =
          (error: unknown): void => {
            if (settled) {
              return;
            }

            settled =
              true;

            source.destroy();
            jsonParser.destroy();
            arrayStreamer.destroy();

            reject(error);
          };

        arrayStreamer.on(
          'data',
          (
            data: {
              value: CucumberFeature;
            }
          ): void => {
            /*
             * Pause while this feature is processed.
             *
             * processFeature() can trigger an HTTP upload.
             */
            arrayStreamer.pause();

            processing =
              processing
                .then(
                  async (): Promise<void> => {
                    await this.processFeature(
                      data.value
                    );
                  }
                )
                .then(
                  (): void => {
                    if (!settled) {
                      arrayStreamer.resume();
                    }
                  }
                )
                .catch(
                  (error: unknown): void => {
                    fail(error);
                  }
                );
          }
        );

        arrayStreamer.once(
          'end',
          (): void => {
            processing
              .then(
                (): void => {
                  if (settled) {
                    return;
                  }

                  settled =
                    true;

                  resolve();
                }
              )
              .catch(
                (error: unknown): void => {
                  fail(error);
                }
              );
          }
        );

        source.once(
          'error',
          (error: Error): void => {
            fail(error);
          }
        );

        jsonParser.once(
          'error',
          (error: Error): void => {
            fail(error);
          }
        );

        arrayStreamer.once(
          'error',
          (error: Error): void => {
            fail(error);
          }
        );
      }
    );

    /*
     * Upload the final partially-filled batch.
     */
    if (
      this.currentBatch.length > 0
    ) {
      await this.flushBatch();
    }

    console.log('');
    console.log(
      'Finished streaming Cucumber report.'
    );
  }

  // ========================================================
  // PROCESS FEATURE
  // ========================================================

  private async processFeature(
    feature: CucumberFeature
  ): Promise<void> {
    this.totalFeatures++;

    const elements =
      Array.isArray(
        feature.elements
      )
        ? feature.elements
        : [];

    /*
     * Some Cucumber JSON producers may create a Feature
     * without elements.
     *
     * Keep it intact.
     */
    if (
      elements.length === 0
    ) {
      await this.addFeatureToBatch(
        feature
      );

      return;
    }

    /*
     * Split large Features by their elements/scenarios.
     *
     * Every generated Feature retains the original metadata:
     *
     * - uri
     * - id
     * - keyword
     * - name
     * - description
     * - tags
     *
     * Only the elements array is split.
     *
     * This lets us create smaller valid Cucumber JSON
     * documents without loading the whole report.
     */

    for (
      const element of elements
    ) {
      this.totalTests++;

      await this.addElementToBatch(
        feature,
        element
      );
    }
  }

  // ========================================================
  // ADD ELEMENT
  // ========================================================

  private async addElementToBatch(
    originalFeature: CucumberFeature,
    element: CucumberElement
  ): Promise<void> {
    /*
     * Create a temporary one-element Feature so we can
     * estimate the JSON size.
     */
    const singleElementFeature:
    CucumberFeature = {
      ...originalFeature,

      elements: [
        element
      ]
    };

    const elementBytes =
      Buffer.byteLength(
        JSON.stringify(
          singleElementFeature
        ),
        'utf8'
      );

    /*
     * Check whether adding this scenario would exceed either:
     *
     * 1. configured byte limit
     * 2. configured scenario/test limit
     */
    const exceedsSize =
      this.currentBatch.length > 0 &&
      this.currentBatchBytes +
        elementBytes >
        this.config.batchSizeBytes;

    const maxTests =
      this.config.maxTestsPerBatch ??
      100;

    const exceedsTestCount =
      this.currentBatchTests > 0 &&
      this.currentBatchTests + 1 >
        maxTests;

    if (
      exceedsSize ||
      exceedsTestCount
    ) {
      await this.flushBatch();
    }

    /*
     * Try to merge this scenario with the last Feature in
     * the current batch when it came from the same original
     * Cucumber Feature.
     *
     * This avoids unnecessarily duplicating Feature metadata.
     */

    const lastFeature =
      this.currentBatch[
        this.currentBatch.length - 1
      ];

    if (
      lastFeature &&
      this.isSameFeature(
        lastFeature,
        originalFeature
      )
    ) {
      if (
        !Array.isArray(
          lastFeature.elements
        )
      ) {
        lastFeature.elements =
          [];
      }

      lastFeature.elements.push(
        element
      );
    } else {
      this.currentBatch.push({
        ...originalFeature,

        elements: [
          element
        ]
      });
    }

    this.currentBatchTests++;

    /*
     * Recalculate approximate batch size.
     *
     * This is slightly more CPU intensive than simply adding
     * elementBytes, but gives much more accurate batching
     * because Feature metadata is shared when elements are
     * merged.
     */
    this.currentBatchBytes =
      Buffer.byteLength(
        JSON.stringify(
          this.currentBatch
        ),
        'utf8'
      );

    /*
     * If a single scenario itself is larger than the target,
     * we cannot safely split it any further.
     */
    if (
      this.currentBatchTests === 1 &&
      this.currentBatchBytes >
        this.config.batchSizeBytes
    ) {
      console.warn('');
      console.warn(
        'WARNING: A single Cucumber test result is larger than the configured batch size.'
      );

      console.warn(
        `Feature  : ${originalFeature.name ?? 'Unknown'}`
      );

      console.warn(
        `Scenario : ${element.name ?? 'Unknown'}`
      );

      console.warn(
        `Size     : ${this.formatBytes(
          this.currentBatchBytes
        )}`
      );
    }
  }

  // ========================================================
  // ADD WHOLE FEATURE
  // ========================================================

  private async addFeatureToBatch(
    feature: CucumberFeature
  ): Promise<void> {
    const featureBytes =
      Buffer.byteLength(
        JSON.stringify(
          feature
        ),
        'utf8'
      );

    if (
      this.currentBatch.length > 0 &&
      this.currentBatchBytes +
        featureBytes >
        this.config.batchSizeBytes
    ) {
      await this.flushBatch();
    }

    this.currentBatch.push(
      feature
    );

    this.currentBatchBytes =
      Buffer.byteLength(
        JSON.stringify(
          this.currentBatch
        ),
        'utf8'
      );
  }

  // ========================================================
  // SAME FEATURE
  // ========================================================

  private isSameFeature(
    left: CucumberFeature,
    right: CucumberFeature
  ): boolean {
    /*
     * Prefer URI + ID.
     */

    if (
      left.uri &&
      right.uri &&
      left.id &&
      right.id
    ) {
      return (
        left.uri === right.uri &&
        left.id === right.id
      );
    }

    /*
     * Fall back to URI + name.
     */

    return (
      left.uri === right.uri &&
      left.name === right.name
    );
  }

  // ========================================================
  // FLUSH BATCH
  // ========================================================

  private async flushBatch(): Promise<void> {
    if (
      this.currentBatch.length === 0
    ) {
      return;
    }

    this.batchNumber++;
    this.totalBatches++;

    const batchNumber =
      this.batchNumber;

    /*
     * Resume support.
     *
     * If state.json says this batch has already been
     * successfully uploaded, don't send it again.
     */
    if (
      this.state &&
      batchNumber <=
        this.state.lastSuccessfulBatch
    ) {
      console.log(
        `Batch ${batchNumber} already uploaded - skipping.`
      );

      this.resetCurrentBatch();

      return;
    }

    const batchPath =
      await this.writeBatchFile(
        batchNumber
      );

    const stats =
      await fs.promises.stat(
        batchPath
      );

    console.log('');
    console.log(
      '--------------------------------------------'
    );

    console.log(
      `XRAY BATCH ${batchNumber}`
    );

    console.log(
      `Features : ${this.currentBatch.length}`
    );

    console.log(
      `Tests    : ${this.currentBatchTests}`
    );

    console.log(
      `Size     : ${this.formatBytes(stats.size)}`
    );

    console.log(
      '--------------------------------------------'
    );

    try {
      if (!this.state) {
        /*
         * ONLY the first batch is allowed to use multipart
         * and therefore create the Test Execution.
         */
        await this.createTestExecutionSafely(
          batchPath,
          batchNumber
        );
      } else {
        /*
         * Every subsequent batch explicitly targets the
         * existing Test Execution.
         */
        await this.uploadToExistingExecution(
          batchPath,
          this.state.testExecutionKey
        );

        this.markBatchSuccessful(
          batchNumber
        );
      }

      await fs.promises.rm(
        batchPath,
        {
          force: true
        }
      );
    } finally {
      this.resetCurrentBatch();
    }
  }

  // ========================================================
  // SAFE FIRST BATCH
  // ========================================================

  private async createTestExecutionSafely(
    batchPath: string,
    batchNumber: number
  ): Promise<void> {
    /*
     * Search Jira immediately before CREATE.
     *
     * Never blindly create a new Test Execution.
     */
    const existing =
      await this.findExistingTestExecution();

    if (existing) {
      console.log('');
      console.log(
        `Existing Test Execution found: ${existing}`
      );

      console.log(
        `Issue URL: ${this.getIssueUrl(existing)}`
      );

      this.createState(
        existing,
        0
      );

      /*
       * Upload this batch explicitly to the existing
       * Test Execution.
       */
      await this.uploadToExistingExecution(
        batchPath,
        existing
      );

      this.markBatchSuccessful(
        batchNumber
      );

      return;
    }

    let lastError: unknown;

    for (
      let attempt = 1;
      attempt <=
        this.config.maxRetries + 1;
      attempt++
    ) {
      try {
        console.log('');
        console.log(
          `Creating Xray Test Execution - attempt ${attempt}`
        );

        const response =
          await this.createExecutionMultipart(
            batchPath
          );

        console.log('');
        console.log(
          'Xray create response:'
        );

        console.log(
          JSON.stringify(
            response,
            null,
            2
          )
        );

        const executionKey =
          this.extractExecutionKey(
            response
          );

        if (!executionKey) {
          throw new Error(
            'Xray returned a successful response but no Test Execution key was found.'
          );
        }

        this.createState(
          executionKey,
          batchNumber
        );

        console.log('');
        console.log(
          `Test Execution created: ${executionKey}`
        );

        console.log(
          `Issue URL: ${this.getIssueUrl(executionKey)}`
        );

        return;
      } catch (error) {
        lastError =
          error;

        const status =
          (error as HttpError)
            .status;

        console.error('');
        console.error(
          `Create attempt ${attempt} failed.`
        );

        if (
          error instanceof Error
        ) {
          console.error(
            error.message
          );
        }

        /*
         * A 502/503/504 or network timeout is ambiguous.
         *
         * Cloudflare may have timed out AFTER Jira/Xray
         * successfully created the Test Execution.
         *
         * Never blindly send another multipart CREATE.
         */
        if (
          this.isAmbiguousCreateFailure(
            status
          )
        ) {
          console.log('');
          console.log(
            'Create result is ambiguous.'
          );

          console.log(
            'Waiting for Jira indexing before checking for the Test Execution...'
          );

          await this.sleep(
            5000
          );

          const recovered =
            await this.findExistingTestExecution();

          if (recovered) {
            console.log('');
            console.log(
              'Test Execution recovered after failed/timeout response.'
            );

            console.log(
              `Test Execution : ${recovered}`
            );

            console.log(
              `Issue URL      : ${this.getIssueUrl(recovered)}`
            );

            /*
             * IMPORTANT:
             *
             * Finding the Jira Test Execution proves that
             * the issue was created.
             *
             * It DOES NOT prove that the complete Cucumber
             * payload finished importing before Cloudflare
             * returned 504.
             *
             * Therefore:
             *
             * 1. Save the execution key.
             * 2. Do NOT mark batch 1 successful.
             * 3. Explicitly upload batch 1 to the recovered
             *    Test Execution.
             */

            this.createState(
              recovered,
              0
            );

            console.log('');
            console.log(
              `Re-uploading batch ${batchNumber} to recovered Test Execution ${recovered}...`
            );

            await this.uploadToExistingExecution(
              batchPath,
              recovered
            );

            this.markBatchSuccessful(
              batchNumber
            );

            console.log(
              `Batch ${batchNumber} confirmed against ${recovered}.`
            );

            return;
          }
        }

        if (
          attempt >
          this.config.maxRetries
        ) {
          break;
        }

        const delay =
          this.getRetryDelay(
            attempt
          );

        console.log(
          `Retrying CREATE in ${delay / 1000} seconds...`
        );

        await this.sleep(
          delay
        );
      }
    }

    if (
      lastError instanceof Error
    ) {
      throw lastError;
    }

    throw new Error(
      'Unable to create Xray Test Execution.'
    );
  }

  // ========================================================
  // MULTIPART CREATE
  // ========================================================

  private async createExecutionMultipart(
    batchPath: string
  ): Promise<XrayResponse> {
    const endpoint =
      `${this.config.jiraBaseUrl}` +
      '/rest/raven/1.0/import/execution/cucumber/multipart';

    /*
     * Equivalent to the info.json you previously supplied
     * with curl.
     */
    const info = {
      fields:
        this.buildJiraFields()
    };

    console.log('');
    console.log(
      'Sending multipart Xray request...'
    );

    console.log(
      `Endpoint : ${endpoint}`
    );

    console.log(
      `Report   : ${path.basename(batchPath)}`
    );

    console.log(
      'Info     : info.json'
    );

    console.log('');
    console.log(
      'info.json:'
    );

    console.log(
      JSON.stringify(
        info,
        null,
        2
      )
    );

    const form =
      new FormData();

    const reportBuffer =
      await fs.promises.readFile(
        batchPath
      );

    /*
     * Equivalent to:
     *
     * -F result=@batch.json
     */
    form.append(
      'result',

      new Blob(
        [
          reportBuffer
        ],
        {
          type:
            'application/json'
        }
      ),

      path.basename(
        batchPath
      )
    );

    /*
     * Equivalent to:
     *
     * -F info=@info.json
     */
    form.append(
      'info',

      new Blob(
        [
          JSON.stringify(
            info
          )
        ],
        {
          type:
            'application/json'
        }
      ),

      'info.json'
    );

    const controller =
      new AbortController();

    const timeout =
      setTimeout(
        (): void => {
          controller.abort();
        },
        this.config.requestTimeoutMs
      );

    try {
      const response =
        await fetch(
          endpoint,
          {
            method:
              'POST',

            headers:
              this.authHeaders(),

            /*
             * Do NOT manually set Content-Type here.
             *
             * Node FormData automatically adds the required
             * multipart boundary.
             */
            body:
              form,

            signal:
              controller.signal
          }
        );

      return await this.handleResponse(
        response
      );
    } finally {
      clearTimeout(
        timeout
      );
    }
  }

  // ========================================================
  // INFO.JSON FIELDS
  // ========================================================

  private buildJiraFields():
  Record<string, unknown> {
    const fields:
    Record<string, unknown> = {
      ...this.config.jiraFields
    };

    if (!fields.project) {
      fields.project = {
        key:
          this.config.projectKey
      };
    }

    if (!fields.summary) {
      fields.summary =
        this.config.executionSummary;
    }

    /*
     * Preserve caller-provided labels and add our unique
     * GitLab pipeline label.
     */
    const labels =
      Array.isArray(
        fields.labels
      )
        ? fields.labels.map(
            value =>
              String(value)
          )
        : [];

    if (
      !labels.includes(
        this.pipelineLabel
      )
    ) {
      labels.push(
        this.pipelineLabel
      );
    }

    fields.labels =
      labels;

    return fields;
  }

  // ========================================================
  // UPLOAD TO EXISTING TEST EXECUTION
  // ========================================================

  private async uploadToExistingExecution(
    batchPath: string,
    executionKey: string
  ): Promise<void> {
    const endpoint =
      `${this.config.jiraBaseUrl}` +
      '/rest/raven/1.0/import/execution/cucumber' +
      '?testExecKey=' +
      encodeURIComponent(
        executionKey
      );

    console.log('');
    console.log(
      `Uploading batch to existing Test Execution ${executionKey}...`
    );

    console.log(
      `Endpoint : ${endpoint}`
    );

    await this.retry(
      async (): Promise<void> => {
        const body =
          await fs.promises.readFile(
            batchPath
          );

        const controller =
          new AbortController();

        const timeout =
          setTimeout(
            (): void => {
              controller.abort();
            },
            this.config.requestTimeoutMs
          );

        try {
          const response =
            await fetch(
              endpoint,
              {
                method:
                  'POST',

                headers: {
                  ...this.authHeaders(),

                  'Content-Type':
                    'application/json'
                },

                body,

                signal:
                  controller.signal
              }
            );

          const result =
            await this.handleResponse(
              response
            );

          console.log(
            'Xray batch response:'
          );

          console.log(
            JSON.stringify(
              result,
              null,
              2
            )
          );
        } finally {
          clearTimeout(
            timeout
          );
        }
      }
    );

    console.log(
      `Batch uploaded successfully to ${executionKey}.`
    );
  }

  // ========================================================
  // FIND EXISTING TEST EXECUTION
  // ========================================================

  private async findExistingTestExecution():
  Promise<string | undefined> {
    const jql =
      `project = "${this.config.projectKey}" ` +
      `AND labels = "${this.pipelineLabel}" ` +
      'ORDER BY created DESC';

    const endpoint =
      `${this.config.jiraBaseUrl}` +
      '/rest/api/2/search' +
      '?jql=' +
      encodeURIComponent(
        jql
      ) +
      '&maxResults=2&fields=key';

    console.log('');
    console.log(
      `Checking Jira for pipeline execution: ${this.pipelineLabel}`
    );

    const controller =
      new AbortController();

    const timeout =
      setTimeout(
        (): void => {
          controller.abort();
        },
        this.config.requestTimeoutMs
      );

    try {
      const response =
        await fetch(
          endpoint,
          {
            method:
              'GET',

            headers:
              this.authHeaders(),

            signal:
              controller.signal
          }
        );

      const responseText =
        await response.text();

      if (!response.ok) {
        throw new Error(
          `Jira search failed. ` +
          `HTTP ${response.status} ${response.statusText}\n` +
          responseText
        );
      }

      const result =
        JSON.parse(
          responseText
        ) as JiraSearchResponse;

      const issues =
        result.issues ??
        [];

      if (
        issues.length === 0
      ) {
        console.log(
          'No existing Test Execution found.'
        );

        return undefined;
      }

      if (
        issues.length > 1
      ) {
        throw new Error(
          `Multiple Jira issues were found with pipeline label ` +
          `"${this.pipelineLabel}": ` +
          issues
            .map(
              issue =>
                issue.key
            )
            .join(', ')
        );
      }

      return issues[0].key;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      throw new Error(
        'Unable to determine whether this GitLab pipeline ' +
        'already has an Xray Test Execution. Upload stopped ' +
        'to prevent duplicate Test Executions. ' +
        `Cause: ${message}`
      );
    } finally {
      clearTimeout(
        timeout
      );
    }
  }

  // ========================================================
  // AUTH HEADERS
  // ========================================================

  private authHeaders():
  Record<string, string> {
    return {
      /*
       * Jira PAT.
       */
      Authorization:
        `Bearer ${this.config.jiraPatToken}`,

      /*
       * Cloudflare Access service token.
       */
      'CF-Access-Client-Id':
        this.config.cfClientId,

      'CF-Access-Client-Secret':
        this.config.cfClientSecret,

      Accept:
        'application/json'
    };
  }

  // ========================================================
  // RESPONSE HANDLING
  // ========================================================

  private async handleResponse(
    response: Response
  ): Promise<XrayResponse> {
    const text =
      await response.text();

    console.log(
      `HTTP status: ${response.status}`
    );

    if (!response.ok) {
      const error =
        new Error(
          [
            'Xray request failed.',
            `HTTP ${response.status} ${response.statusText}`,
            text
          ].join(
            '\n'
          )
        ) as HttpError;

      error.status =
        response.status;

      throw error;
    }

    if (!text.trim()) {
      return {};
    }

    try {
      return JSON.parse(
        text
      ) as XrayResponse;
    } catch {
      console.log(
        'Xray returned a non-JSON response:'
      );

      console.log(
        text
      );

      return {};
    }
  }

  // ========================================================
  // RETRY EXISTING-EXECUTION UPLOAD
  // ========================================================

  private async retry<T>(
    action: () => Promise<T>
  ): Promise<T> {
    let lastError: unknown;

    for (
      let attempt = 1;
      attempt <=
        this.config.maxRetries + 1;
      attempt++
    ) {
      try {
        return await action();
      } catch (error) {
        lastError =
          error;

        const status =
          (error as HttpError)
            .status;

        console.error('');
        console.error(
          `Request attempt ${attempt} failed.`
        );

        if (
          error instanceof Error
        ) {
          console.error(
            error.message
          );
        }

        const retryable =
          status === undefined ||
          [
            408,
            429,
            500,
            502,
            503,
            504
          ].includes(
            status
          );

        if (
          !retryable ||
          attempt >
            this.config.maxRetries
        ) {
          break;
        }

        const delay =
          this.getRetryDelay(
            attempt
          );

        console.log(
          `Retrying in ${delay / 1000} seconds...`
        );

        await this.sleep(
          delay
        );
      }
    }

    if (
      lastError instanceof Error
    ) {
      throw lastError;
    }

    throw new Error(
      'Xray request failed.'
    );
  }

  // ========================================================
  // STATE
  // ========================================================

  private createState(
    executionKey: string,
    lastSuccessfulBatch: number
  ): void {
    const now =
      new Date()
        .toISOString();

    this.state = {
      pipelineId:
        this.config.pipelineId,

      testExecutionKey:
        executionKey,

      lastSuccessfulBatch,

      createdAt:
        now,

      updatedAt:
        now
    };

    this.saveState();
  }

  private markBatchSuccessful(
    batchNumber: number
  ): void {
    if (!this.state) {
      throw new Error(
        'Xray upload state is missing.'
      );
    }

    this.state.lastSuccessfulBatch =
      batchNumber;

    this.state.updatedAt =
      new Date()
        .toISOString();

    this.saveState();
  }

  private loadState():
  UploadState | undefined {
    if (
      !fs.existsSync(
        this.config.statePath
      )
    ) {
      return undefined;
    }

    try {
      const state =
        JSON.parse(
          fs.readFileSync(
            this.config.statePath,
            'utf8'
          )
        ) as UploadState;

      if (
        state.pipelineId !==
        this.config.pipelineId
      ) {
        console.log(
          'Ignoring Xray state from another GitLab pipeline.'
        );

        return undefined;
      }

      return state;
    } catch {
      console.warn(
        'Unable to read Xray state.json. Jira will be checked instead.'
      );

      return undefined;
    }
  }

  private saveState(): void {
    if (!this.state) {
      return;
    }

    const tempPath =
      `${this.config.statePath}.tmp`;

    fs.writeFileSync(
      tempPath,
      JSON.stringify(
        this.state,
        null,
        2
      ),
      'utf8'
    );

    fs.renameSync(
      tempPath,
      this.config.statePath
    );
  }

  // ========================================================
  // WRITE BATCH
  // ========================================================

  private async writeBatchFile(
    batchNumber: number
  ): Promise<string> {
    const filename =
      `batch-${String(batchNumber).padStart(
        5,
        '0'
      )}.json`;

    const batchPath =
      path.join(
        this.config.workingDirectory,
        filename
      );

    await fs.promises.writeFile(
      batchPath,

      JSON.stringify(
        this.currentBatch
      ),

      'utf8'
    );

    return batchPath;
  }

  // ========================================================
  // RESET BATCH
  // ========================================================

  private resetCurrentBatch(): void {
    this.currentBatch =
      [];

    this.currentBatchBytes =
      2;

    this.currentBatchTests =
      0;
  }

  // ========================================================
  // EXTRACT EXECUTION KEY
  // ========================================================

  private extractExecutionKey(
    response: XrayResponse
  ): string | undefined {
    return (
      response.testExecIssue?.key ??
      response.key
    );
  }

  // ========================================================
  // ISSUE URL
  // ========================================================

  private getIssueUrl(
    executionKey: string
  ): string {
    return (
      `${this.config.jiraBaseUrl}` +
      `/browse/${executionKey}`
    );
  }

  // ========================================================
  // AMBIGUOUS CREATE FAILURE
  // ========================================================

  private isAmbiguousCreateFailure(
    status: number | undefined
  ): boolean {
    /*
     * No HTTP status generally means:
     *
     * - connection reset
     * - AbortController timeout
     * - network failure
     *
     * Jira/Xray may still have processed the request.
     */
    if (
      status === undefined
    ) {
      return true;
    }

    return [
      502,
      503,
      504
    ].includes(
      status
    );
  }

  // ========================================================
  // RETRY DELAY
  // ========================================================

  private getRetryDelay(
    attempt: number
  ): number {
    return (
      this.config.retryDelayMs *
      Math.pow(
        2,
        attempt - 1
      )
    );
  }

  // ========================================================
  // WORKING DIRECTORY
  // ========================================================

  private prepareWorkingDirectory(): void {
    fs.mkdirSync(
      this.config.workingDirectory,
      {
        recursive:
          true
      }
    );
  }

  // ========================================================
  // VALIDATION
  // ========================================================

  private validate(): void {
    const required:
    Array<[string, string]> = [
      [
        'JIRA_BASE_URL',
        this.config.jiraBaseUrl
      ],
      [
        'JIRA_PAT_TOKEN',
        this.config.jiraPatToken
      ],
      [
        'CF_Access_Client_Id',
        this.config.cfClientId
      ],
      [
        'CF_Access_Client_Secret',
        this.config.cfClientSecret
      ],
      [
        'XRAY_PROJECT_KEY',
        this.config.projectKey
      ]
    ];

    const missing =
      required
        .filter(
          ([, value]) =>
            !value.trim()
        )
        .map(
          ([name]) =>
            name
        );

    if (
      missing.length > 0
    ) {
      throw new Error(
        `Missing required configuration: ${missing.join(', ')}`
      );
    }

    if (
      !fs.existsSync(
        this.config.reportPath
      )
    ) {
      throw new Error(
        `Cucumber report not found: ${this.config.reportPath}`
      );
    }

    if (
      this.config.batchSizeBytes <= 0
    ) {
      throw new Error(
        'Xray batch size must be greater than zero.'
      );
    }

    if (
      this.config.maxTestsPerBatch !== undefined &&
      this.config.maxTestsPerBatch <= 0
    ) {
      throw new Error(
        'Xray maximum tests per batch must be greater than zero.'
      );
    }
  }

  // ========================================================
  // EXISTING STATE LOG
  // ========================================================

  private logExistingState(): void {
    if (!this.state) {
      return;
    }

    console.log('');
    console.log(
      'Existing Xray upload state found.'
    );

    console.log(
      `Test Execution       : ${this.state.testExecutionKey}`
    );

    console.log(
      `Last successful batch: ${this.state.lastSuccessfulBatch}`
    );

    console.log(
      `Issue URL            : ${this.getIssueUrl(
        this.state.testExecutionKey
      )}`
    );
  }

  // ========================================================
  // HEADER
  // ========================================================

  private printHeader(): void {
    const stats =
      fs.statSync(
        this.config.reportPath
      );

    console.log('');
    console.log(
      '============================================'
    );

    console.log(
      'JIRA XRAY CUCUMBER UPLOADER'
    );

    console.log(
      '============================================'
    );

    console.log(
      `Pipeline       : ${this.config.pipelineId}`
    );

    console.log(
      `Pipeline label : ${this.pipelineLabel}`
    );

    console.log(
      `Report         : ${this.config.reportPath}`
    );

    console.log(
      `Report size    : ${this.formatBytes(stats.size)}`
    );

    console.log(
      `Batch target   : ${this.formatBytes(
        this.config.batchSizeBytes
      )}`
    );

    console.log(
      `Tests / batch  : ${
        this.config.maxTestsPerBatch ??
        100
      }`
    );

    console.log(
      `Project        : ${this.config.projectKey}`
    );

    console.log(
      '============================================'
    );
  }

  // ========================================================
  // COMPLETION SUMMARY
  // ========================================================

  private printCompletionSummary(): void {
    if (!this.state) {
      return;
    }

    console.log('');
    console.log(
      '============================================'
    );

    console.log(
      'XRAY UPLOAD COMPLETED SUCCESSFULLY'
    );

    console.log(
      '============================================'
    );

    console.log(
      `Test Execution : ${this.state.testExecutionKey}`
    );

    console.log(
      `Issue URL      : ${this.getIssueUrl(
        this.state.testExecutionKey
      )}`
    );

    console.log(
      `Features       : ${this.totalFeatures}`
    );

    console.log(
      `Tests          : ${this.totalTests}`
    );

    console.log(
      `Batches        : ${this.totalBatches}`
    );

    console.log(
      '============================================'
    );
  }

  // ========================================================
  // FORMAT BYTES
  // ========================================================

  private formatBytes(
    bytes: number
  ): string {
    const units = [
      'B',
      'KB',
      'MB',
      'GB',
      'TB'
    ];

    let value =
      bytes;

    let index =
      0;

    while (
      value >= 1024 &&
      index <
        units.length - 1
    ) {
      value /=
        1024;

      index++;
    }

    return (
      `${value.toFixed(2)} ${units[index]}`
    );
  }

  // ========================================================
  // SLEEP
  // ========================================================

  private async sleep(
    milliseconds: number
  ): Promise<void> {
    await new Promise<void>(
      resolve =>
        setTimeout(
          resolve,
          milliseconds
        )
    );
  }
}