import { Page, Locator, expect } from '@playwright/test';
import { LocatorType, WebElementAction } from '../support/testConstant';
import { Log } from '../support/logger';

export class WebHelper {
  private page: Page;

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

  public IdentifyWebElement(locatorType: LocatorType, value: string): Locator {
    const selector = this.buildSelector(locatorType, value);
    Log.info('Identifying web element', { locatorType, selector });
    return this.page.locator(selector);
  }

  public IdentifyWebElements(locatorType: LocatorType, value: string): Locator {
    const selector = this.buildSelector(locatorType, value);
    Log.info('Identifying web elements', { locatorType, selector });
    return this.page.locator(selector);
  }

  public async WaitForElementToBeVisible(locator: Locator): Promise<void> {
    Log.debug('Waiting for element to be visible');
    await locator.waitFor({ state: 'visible' });
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
    value?: string
  ): Promise<void> {
     Log.info('Performing web element action', { action, value });
    try {
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
     Log.debug('Web element action completed', { action, value });
  } catch (err) {
      Log.error('Error performing web element action', {
        action,
        value,
        error: (err as Error).message
      });
      throw err;
    }
  }

  public async PerformKeyboardEvent(key: string): Promise<void> {
    Log.info('Performing keyboard event', { key });
    await this.page.keyboard.press(key);
    Log.debug('Keyboard event performed', { key });
  }

  public async GetTextAsync(locator: Locator): Promise<string> {
    Log.info('Getting text from element');
    const text = (await locator.textContent()) ?? '';
    Log.debug('Retrieved text', { text });
    return text;
  }

  public async IsVisibleAsync(locator: Locator): Promise<boolean> {
    const visible = await locator.isVisible();
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
    await expect(locator).toBeVisible();
    Log.info('Locator is visible');
  }
}
