import { Page,Locator } from '@playwright/test';
import { WebHelper } from '../../framework/playwrightHelpers/webHelper';
import { LocatorType, WebElementAction } from '../../framework/support/testConstant';

export class LandingPage {
  private webHelper: WebHelper;

  private userBtn: Locator;
  private createNewAccountBtn: Locator;
  private products: Locator;
  private loadingSpinner: Locator;

  constructor(page: Page) {
    this.webHelper = new WebHelper(page);

    this.userBtn = this.webHelper.IdentifyWebElement(LocatorType.CssSelector, '#menuUserLink');

    this.createNewAccountBtn = this.webHelper.IdentifyWebElement(
      LocatorType.CssSelector,
      "[class^='create-new-account']"
    );

    this.products = this.webHelper.IdentifyWebElement(
      LocatorType.CssSelector,
      "#our_products"
    );

    this.loadingSpinner = this.webHelper.IdentifyWebElement(
      LocatorType.CssSelector,
      '.loader div svg'
    );
  }

  async waitForLoadingSpinnerToDisappear(): Promise<void> {
    await this.webHelper
      .WaitForElementToBeInVisible(this.loadingSpinner)
      .catch(() => {
      });
  }

  async landingPageIsDisplayed(): Promise<boolean> {
    return this.webHelper.IsVisibleAsync(this.userBtn);
  }

  async clickUserBtn(): Promise<void> {
    await this.webHelper.PerformWebELementAction(
      this.userBtn,
      WebElementAction.Click
    );
  }

  async clickCreateNewAccount(): Promise<void> {
    await this.webHelper.PerformWebELementAction(
      this.createNewAccountBtn,
      WebElementAction.Click
    );
  }
}
