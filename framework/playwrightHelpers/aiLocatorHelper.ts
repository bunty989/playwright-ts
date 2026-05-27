import { LocatorType } from '../support/testConstant';
import { Log } from '../support/logger';
import { parseBooleanEnv, parseStringEnv } from '../support/envUtils';
import { ApiHelper } from './apiHelper';

export interface SelfHealingLocator {
  locatorType: LocatorType;
  locator: string;
  confidence: number;
  reason?: string;
}

interface ChatCompletionChoice {
  message?: {
    content?: string;
  };
}

interface GenAIResponse {
  choices?: ChatCompletionChoice[];
  output_text?: string;
}

const DEFAULT_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'openai/gpt-oss-120b';
const DEFAULT_TIMEOUT_SECONDS = 30;
const MAX_HTML_LENGTH = 60000;

export class AiLocatorHelper {
  static isEnabled(elementDescription?: string): boolean {
    const enabled = parseBooleanEnv(process.env.GENAI_ENABLED, true);
    return enabled && Boolean(elementDescription?.trim());
  }

  static async callGenAIService(
    pageSource: string,
    elementDescription: string,
    originalLocatorType: LocatorType,
    originalLocatorInfo: string
  ): Promise<SelfHealingLocator | undefined> {
    const apiKey = AiLocatorHelper.readApiKey();

    if (!apiKey) {
      Log.warn('Gen AI self-healing skipped because no API key was configured.');
      return undefined;
    }

    const endpoint =
      parseStringEnv(process.env.GENAI_ENDPOINT) ?? DEFAULT_ENDPOINT;
    const model = parseStringEnv(process.env.GENAI_MODEL) ?? DEFAULT_MODEL;
    const timeoutSeconds = Number.parseInt(
      process.env.GENAI_TIMEOUT_SECONDS ?? '',
      10
    );

    const timeoutMs =
      Number.isFinite(timeoutSeconds) && timeoutSeconds > 0
        ? timeoutSeconds * 1000
        : DEFAULT_TIMEOUT_SECONDS * 1000;

    try {
      const json = await AiLocatorHelper.postJson<GenAIResponse>(
        endpoint,
        {
          model,
          messages: [
            {
              role: 'system',
              content:
                'You repair Playwright locators. Return ONLY valid JSON. Do not return markdown. Do not explain anything. Return this exact schema: { locatorType, locator, confidence, reason }',
            },
            {
              role: 'user',
              content: AiLocatorHelper.buildPrompt(
                pageSource,
                elementDescription,
                originalLocatorType,
                originalLocatorInfo
              ),
            },
          ],
          reasoning: {
            enabled: true,
          },
          temperature: 0.2,
        },
        {
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://playwright-cucumber-ts.local',
          'X-Title': 'Playwright Cucumber TS Framework',
        },
        timeoutMs
      );
      Log.info('Gen AI raw response received');

      const responseText = AiLocatorHelper.extractResponseText(json);
      const locatorJson = AiLocatorHelper.cleanupJson(responseText ?? '');

      if (!locatorJson) {
        Log.error('Gen AI API response did not contain locator JSON.');
        return undefined;
      }

      const parsed = JSON.parse(locatorJson) as Partial<SelfHealingLocator>;
      return AiLocatorHelper.validateLocatorSuggestion(parsed);
    } catch (err) {
      Log.error('Exception during Gen AI API call', {
        error: err instanceof Error ? err.message : String(err),
      });
      return undefined;
    }
  }

  private static async postJson<T>(
    endpoint: string,
    payload: unknown,
    headers: Record<string, string>,
    timeoutMs: number
  ): Promise<T> {
    const url = new URL(endpoint);
    const apiHelper = new ApiHelper();

    await apiHelper.setupApiRequestClient(
      url.origin,
      {
        ...headers,
        'Content-Type': 'application/json',
      },
      timeoutMs
    );

    const response = await apiHelper.postAsync(`${url.pathname}${url.search}`, payload);
    const responseBody = await response.text();

    if (!response.ok()) {
      throw new Error(
        `Gen AI API call failed: ${response.status()} ${response.statusText()} ${responseBody}`
      );
    }

    return JSON.parse(responseBody) as T;
  }

  private static readApiKey(): string | undefined {
    return (
      parseStringEnv(process.env.API_KEY) ??
      parseStringEnv(process.env.GENAI_API_KEY) ??
      parseStringEnv(process.env.OPENROUTER_API_KEY)
    );
  }

  private static buildPrompt(
    pageSource: string,
    elementDescription: string,
    originalLocatorType: LocatorType,
    originalLocatorInfo: string
  ): string {
    return [
      'Find a replacement Playwright locator for the target element.',
      `Target element description: ${elementDescription}`,
      `Failed locator type: ${originalLocatorType}`,
      `Failed locator value: ${originalLocatorInfo}`,
      'Prefer stable ids, names, data attributes, accessible labels, visible text, or compact CSS selectors.',
      'Use XPath only when CSS or direct attributes are not reliable.',
      'Do not return the failed locator unchanged unless it is definitively correct.',
      'Return ONLY valid JSON.',
      `Allowed locatorType values: ${Object.values(LocatorType).join(', ')}`,
      '',
      'HTML:',
      AiLocatorHelper.truncatePageSource(pageSource),
    ].join('\n');
  }

  private static truncatePageSource(pageSource: string): string {
    return pageSource.length <= MAX_HTML_LENGTH
      ? pageSource
      : pageSource.slice(0, MAX_HTML_LENGTH);
  }

  private static extractResponseText(response: GenAIResponse): string | undefined {
    return response.output_text ?? response.choices?.[0]?.message?.content;
  }

  private static cleanupJson(content: string): string {
    const trimmed = content.trim();

    if (trimmed.startsWith('```json')) {
      return trimmed.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
    }

    if (trimmed.startsWith('```')) {
      return trimmed.replace(/^```\s*/, '').replace(/\s*```$/, '').trim();
    }

    return trimmed;
  }

  private static validateLocatorSuggestion(
    suggestion: Partial<SelfHealingLocator>
  ): SelfHealingLocator | undefined {
    if (!suggestion.locatorType || !suggestion.locator) {
      Log.error('Gen AI API response did not contain locatorType and locator properties.');
      return undefined;
    }

    const locatorType = Object.values(LocatorType).find(
      value => value.toLowerCase() === suggestion.locatorType?.toLowerCase()
    );

    if (!locatorType || !suggestion.locator.trim()) {
      Log.error('Gen AI API returned an invalid locator suggestion.');
      return undefined;
    }

    return {
      locatorType,
      locator: suggestion.locator,
      confidence:
        typeof suggestion.confidence === 'number' ? suggestion.confidence : 0,
      reason: suggestion.reason,
    };
  }
}
