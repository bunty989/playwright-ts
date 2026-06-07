import { Page, Locator, expect } from '@playwright/test';
import { LocatorType, WebElementAction } from '../support/testConstant';
import { Log } from '../support/logger';
import { AiLocatorHelper, SelfHealingLocator } from './aiLocatorHelper';
import { SelfHealingAudit } from './selfHealingAudit';

interface LocatorMetadata {
  locatorType: LocatorType;
  value: string;
  elementDescription: string;
  healedLocator?: Locator;
  healedSuggestion?: SelfHealingLocator;
}

export class WebHelper {
  private page: Page;
  private readonly locatorMetadata = new WeakMap<Locator, LocatorMetadata>();

  constructor(page: Page) {
    this.page = page;
  }

  private buildSelector(locatorType: LocatorType, value: string): string {
    switch (locatorType) {
      case LocatorType.CssSelector:
        return value;
      case LocatorType.Id:
        return `#${value}`;
      case LocatorType.Text:
        return `text=${value}`;
      case LocatorType.XPath:
        return `xpath=${value}`;
      default:
        return value;
    }
  }

  public IdentifyWebElement(
    locatorType: LocatorType,
    value: string,
    elementDescription?: string
  ): Locator {
    const selector = this.buildSelector(locatorType, value);
    Log.info('Identifying web element', { locatorType, selector });
    const locator = this.page.locator(selector);
    this.locatorMetadata.set(locator, {
      locatorType,
      value,
      elementDescription: elementDescription?.trim() || `${locatorType}: ${value}`,
    });
    return locator;
  }

  public async IdentifyWebElements(
    locatorType: LocatorType,
    value: string,
    elementDescription?: string
  ): Promise<Locator[]> {
    const selector = this.buildSelector(locatorType, value);
    Log.info('Identifying web elements', { locatorType, selector });
    const locator = this.page.locator(selector);
    this.locatorMetadata.set(locator, {
      locatorType,
      value,
      elementDescription: elementDescription?.trim() || `${locatorType}: ${value}`,
    });
    return this.getLocatorCollection(locator, locatorType, value, elementDescription);
  }

  public IdentifyWebElementsLocator(
    locatorType: LocatorType,
    value: string,
    elementDescription?: string
  ): Locator {
    const selector = this.buildSelector(locatorType, value);
    Log.info('Identifying web elements locator', { locatorType, selector });
    const locator = this.page.locator(selector);
    this.locatorMetadata.set(locator, {
      locatorType,
      value,
      elementDescription: elementDescription?.trim() || `${locatorType}: ${value}`,
    });
    return locator;
  }

  public async FindDynamicWebTableCellLocator(
    webTable: Locator,
    matchingColumnName: string,
    matchingColumnValue: string,
    targetColumnName: string
  ): Promise<Locator> {
    Log.info('Finding dynamic web table cell locator', {
      matchingColumnName,
      matchingColumnValue,
      targetColumnName,
    });

    const tableLocator = this.getActiveLocator(webTable);
    const headerCells = await this.getWebTableHeaderCells(tableLocator);
    const headers = await this.getNormalizedCellTexts(headerCells);
    const matchingColumnIndex = this.findColumnIndex(headers, matchingColumnName);
    const targetColumnIndex = this.findColumnIndex(headers, targetColumnName);

    const bodyRows = tableLocator.locator('tbody tr');
    const hasBodyRows = (await bodyRows.count()) > 0;
    const rows = hasBodyRows ? bodyRows : tableLocator.locator('tr');
    const firstDataRowIndex = hasBodyRows ? 0 : 1;

    const rowCount = await rows.count();
    for (let rowIndex = firstDataRowIndex; rowIndex < rowCount; rowIndex++) {
      const row = rows.nth(rowIndex);
      const cells = row.locator('th, td');
      const matchingCell = cells.nth(matchingColumnIndex);
      const actualValue = this.normalizeText((await matchingCell.textContent()) ?? '');

      if (actualValue === this.normalizeText(matchingColumnValue)) {
        const targetCell = cells.nth(targetColumnIndex);
        this.locatorMetadata.set(targetCell, {
          locatorType: LocatorType.CssSelector,
          value: 'dynamic web table cell',
          elementDescription: `Cell in "${targetColumnName}" where "${matchingColumnName}" is "${matchingColumnValue}"`,
        });
        Log.info('Dynamic web table cell locator found', {
          rowIndex,
          matchingColumnName,
          matchingColumnValue,
          targetColumnName,
        });
        return targetCell;
      }
    }

    throw new Error(
      `No web table row found where "${matchingColumnName}" equals "${matchingColumnValue}".`
    );
  }

  public async WaitForElementToBeVisible(locator: Locator): Promise<void> {
    Log.debug('Waiting for element to be visible');
    const targetLocator = this.getActiveLocator(locator);
    try {
      await targetLocator.waitFor({ state: 'visible' });
    } catch (err) {
      Log.error('Error waiting for element to be visible', {
        error: err instanceof Error ? err.message : String(err),
      });
      const recoveredLocator = await this.recoverLocatorAfterFailure(locator);
      await recoveredLocator.waitFor({ state: 'visible' });
    }
    Log.debug('Element is now visible');
  }

  public async WaitForElementToBeInVisible(locator: Locator): Promise<void> {
    Log.debug('Waiting for element to be invisible');
    await locator.waitFor({ state: 'hidden' });
    Log.debug('Element is now invisible');
  }

  public async PerformWebELementAction(
    locator: Locator,
    action: WebElementAction,
    value?: string,
    loggingEnabled?: boolean
  ): Promise<void> {
     Log.info('Performing web element action', { action, value });
    try {
    await this.executeAction(this.getActiveLocator(locator), action, value);
    if (loggingEnabled) {
     Log.debug('Web element action completed', { action, value });
    }
  } catch (err) {
      Log.error('Error performing web element action', {
        action,
        value,
        error: (err as Error).message
      });
      const recoveredLocator = await this.recoverLocatorAfterFailure(locator);
      await this.executeAction(recoveredLocator, action, value);
    }
  }

  public async PerformKeyboardEvent(key: string): Promise<void> {
    Log.info('Performing keyboard event', { key });
    await this.page.keyboard.press(key);
    Log.debug('Keyboard event performed', { key });
  }

  public async GetTextAsync(locator: Locator): Promise<string> {
    Log.info('Getting text from element');
    let text: string;
    try {
      text = (await this.getActiveLocator(locator).textContent()) ?? '';
    } catch (err) {
      Log.error('Error getting text from element', {
        error: err instanceof Error ? err.message : String(err),
      });
      const recoveredLocator = await this.recoverLocatorAfterFailure(locator);
      text = (await recoveredLocator.textContent()) ?? '';
    }
    Log.debug('Retrieved text', { text });
    return text;
  }

  public async IsVisibleAsync(locator: Locator): Promise<boolean> {
    const visible = await this.getActiveLocator(locator).isVisible();
    Log.info('Element visibility check', { visible });
    return visible;
  }

  public async GoTo(url: string): Promise<void> {
    Log.info('Navigating to URL', { url });
    await this.page.goto(url, { waitUntil: 'networkidle' });
    Log.info('Navigation completed', { url });
  }

  public async ExpectVisible(locator: Locator): Promise<void> {
    Log.info('Expecting locator to be visible');
    try {
      await expect(this.getActiveLocator(locator)).toBeVisible();
    } catch (err) {
      Log.error('Expect visible failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      await expect(await this.recoverLocatorAfterFailure(locator)).toBeVisible();
    }
    Log.info('Locator is visible');
  }

  private getActiveLocator(locator: Locator): Locator {
    const metadata = this.locatorMetadata.get(locator);
    return metadata?.healedLocator ?? locator;
  }

  private async executeAction(
    locator: Locator,
    action: WebElementAction,
    value?: string
  ): Promise<void> {
    switch (action) {
      case WebElementAction.Click:
        await locator.click();
        break;
      case WebElementAction.EnterText:
        await locator.fill(value ?? '');
        break;
      case WebElementAction.Clear:
        await locator.fill('');
        break;
      case WebElementAction.Hover:
        await locator.hover();
        break;
      default:
        throw new Error(`Unsupported WebElementAction: ${action}`);
    }
  }

  private async getLocatorCollection(
    locator: Locator,
    locatorType: LocatorType,
    value: string,
    elementDescription?: string
  ): Promise<Locator[]> {
    const count = await locator.count();
    const locators = Array.from({ length: count }, (_, index) => locator.nth(index));
    locators.forEach((item, index) => {
      this.locatorMetadata.set(item, {
        locatorType,
        value,
        elementDescription:
          elementDescription?.trim() || `${locatorType}: ${value} [${index}]`,
      });
    });
    Log.info('Identified web elements count', { locatorType, value, count });
    return locators;
  }

  private async getWebTableHeaderCells(tableLocator: Locator): Promise<Locator> {
    const theadHeaderCells = tableLocator.locator('thead tr').first().locator('th, td');
    if ((await theadHeaderCells.count()) > 0) {
      return theadHeaderCells;
    }

    const firstRowHeaderCells = tableLocator.locator('tr').first().locator('th, td');
    if ((await firstRowHeaderCells.count()) > 0) {
      return firstRowHeaderCells;
    }

    throw new Error('No header row found in the supplied web table locator.');
  }

  private async getNormalizedCellTexts(cells: Locator): Promise<string[]> {
    const texts = await cells.allTextContents();
    return texts.map(text => this.normalizeText(text));
  }

  private findColumnIndex(headers: string[], columnName: string): number {
    const normalizedColumnName = this.normalizeText(columnName);
    const index = headers.findIndex(header => header === normalizedColumnName);

    if (index === -1) {
      throw new Error(
        `Column "${columnName}" was not found. Available columns: ${headers.join(', ')}`
      );
    }

    return index;
  }

  private normalizeText(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
  }

  private async recoverLocatorAfterFailure(locator: Locator): Promise<Locator> {
    const metadata = this.locatorMetadata.get(locator);
    const activeLocator = metadata?.healedLocator ?? locator;

    if (!metadata) {
      return locator;
    }

    const recoveredLocator = await this.tryRecoverLocatorWithoutAI(metadata);
    if (recoveredLocator) {
      metadata.healedLocator = recoveredLocator;
      return recoveredLocator;
    }

    if (!AiLocatorHelper.isEnabled(metadata.elementDescription)) {
      return activeLocator;
    }

    const aiRecoveredLocator = await this.tryRecoverLocatorWithGenAI(metadata);
    return aiRecoveredLocator ?? activeLocator;
  }

  private async tryRecoverLocatorWithoutAI(
    metadata: LocatorMetadata
  ): Promise<Locator | undefined> {
    try {
      Log.debug('Starting framework self-healing checks', {
        locatorType: metadata.locatorType,
        value: metadata.value,
      });

      const candidate = this.page.locator(
        this.buildSelector(metadata.locatorType, metadata.value)
      );

      if ((await candidate.count()) > 0 && (await candidate.first().isVisible())) {
        Log.info('Framework self-healing recovered locator without Gen AI', {
          locatorType: metadata.locatorType,
          value: metadata.value,
        });
        return candidate;
      }
    } catch (err) {
      Log.debug('Framework self-healing checks did not recover locator', {
        locatorType: metadata.locatorType,
        value: metadata.value,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    return undefined;
  }

  private async tryRecoverLocatorWithGenAI(
    metadata: LocatorMetadata
  ): Promise<Locator | undefined> {
    Log.info('Gen AI self-healing requested for element', {
      elementDescription: metadata.elementDescription,
      locatorType: metadata.locatorType,
      value: metadata.value,
    });

    const suggestion = await AiLocatorHelper.callGenAIService(
      await this.page.content(),
      metadata.elementDescription,
      metadata.locatorType,
      metadata.value
    );

    if (!suggestion) {
      Log.error('Gen AI self-healing did not return a usable locator', {
        elementDescription: metadata.elementDescription,
      });
      return undefined;
    }

    Log.info('Gen AI self-healing suggested locator', {
      locatorType: suggestion.locatorType,
      locator: suggestion.locator,
      confidence: suggestion.confidence,
      reason: suggestion.reason,
    });

    try {
      const healedLocator = this.page.locator(
        this.buildSelector(suggestion.locatorType, suggestion.locator)
      );
      await healedLocator.first().waitFor({ state: 'visible', timeout: 5000 });

      metadata.healedLocator = healedLocator;
      metadata.healedSuggestion = suggestion;

      SelfHealingAudit.recordSuccessfulHeal(
        metadata.elementDescription,
        metadata.locatorType,
        metadata.value,
        suggestion,
        this.page.url(),
        await this.page.title().catch(() => undefined),
        false,
        await healedLocator.count().catch(() => 1)
      );

      return healedLocator;
    } catch (err) {
      Log.error('Gen AI self-healing locator failed', {
        elementDescription: metadata.elementDescription,
        locatorType: suggestion.locatorType,
        locator: suggestion.locator,
        error: err instanceof Error ? err.message : String(err),
      });
      return undefined;
    }
  }
}
