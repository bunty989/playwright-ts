// test/pages/createAccount.page.ts
import { Page,Locator } from '@playwright/test';
import { WebHelper } from '../../framework/playwrightHelpers/webHelper';
import { LocatorType, WebElementAction } from '../../framework/support/testConstant';

export class CreateAccountPage {
  private webHelper: WebHelper;

  private headerText: Locator;

  private userNameField: Locator;
  private emailField: Locator;
  private passwordField: Locator;
  private confirmPasswordField: Locator;

  private userNameErrorLabel: Locator;
  private emailErrorLabel: Locator;
  private passwordErrorLabel: Locator;
  private confirmPasswordErrorLabel: Locator;

  constructor(page: Page) {
    this.webHelper = new WebHelper(page);

    this.headerText = this.webHelper.IdentifyWebElement(
      LocatorType.CssSelector,
      "#registerPage h3[class^='robo']"
    );

    this.userNameField = this.webHelper.IdentifyWebElement(
      LocatorType.CssSelector,
      "[name='usernameRegisterPage']"
    );

    this.emailField = this.webHelper.IdentifyWebElement(
      LocatorType.CssSelector,
      "[name='emailRegisterPage']"
    );

    this.passwordField = this.webHelper.IdentifyWebElement(
      LocatorType.CssSelector,
      "[name='passwordRegisterPage']"
    );

    this.confirmPasswordField = this.webHelper.IdentifyWebElement(
      LocatorType.CssSelector,
      "[name='confirm_passwordRegisterPage']"
    );

    this.userNameErrorLabel = this.webHelper.IdentifyWebElement(
      LocatorType.CssSelector,
      "[name='usernameRegisterPage'] +label"
    );

    this.emailErrorLabel = this.webHelper.IdentifyWebElement(
      LocatorType.CssSelector,
      "[name='emailRegisterPage'] +label"
    );

    this.passwordErrorLabel = this.webHelper.IdentifyWebElement(
      LocatorType.CssSelector,
      "[name='passwordRegisterPage'] +label"
    );

    this.confirmPasswordErrorLabel = this.webHelper.IdentifyWebElement(
      LocatorType.CssSelector,
      "[name='confirm_passwordRegisterPage'] +label"
    );
  }

  async waitForHeaderTextToBeDisplayed(timeoutMs = 10000): Promise<void> {
    await this.webHelper.WaitForElementToBeVisible(this.headerText);
  }

  async enterUserName(name: string): Promise<void> {
    await this.webHelper.PerformWebELementAction(
      this.userNameField,
      WebElementAction.EnterText,
      name
    );
  }

  async enterEmail(email: string): Promise<void> {
    await this.webHelper.PerformWebELementAction(
      this.emailField,
      WebElementAction.EnterText,
      email
    );
  }

  async enterPassword(password: string): Promise<void> {
    await this.webHelper.PerformWebELementAction(
      this.passwordField,
      WebElementAction.EnterText,
      password
    );
  }

  async enterConfirmPassword(confirmPassword: string): Promise<void> {
    await this.webHelper.PerformWebELementAction(
      this.confirmPasswordField,
      WebElementAction.EnterText,
      confirmPassword
    );
  }

  async getUserNameErrorLabel(): Promise<string> {
    await this.webHelper.PerformWebELementAction(
      this.userNameField,
      WebElementAction.Click
    );
    await this.webHelper.PerformKeyboardEvent('Tab');
    return (await this.webHelper.GetTextAsync(this.userNameErrorLabel)).trim();
  }

  async getEmailErrorLabel(): Promise<string> {
    await this.webHelper.PerformWebELementAction(
      this.emailField,
      WebElementAction.Click
    );
    await this.webHelper.PerformKeyboardEvent('Tab');
    return (await this.webHelper.GetTextAsync(this.emailErrorLabel)).trim();
  }

  async getPasswordErrorLabel(): Promise<string> {
    await this.webHelper.PerformWebELementAction(
      this.passwordField,
      WebElementAction.Click
    );
    await this.webHelper.PerformKeyboardEvent('Tab');
    return (await this.webHelper.GetTextAsync(this.passwordErrorLabel)).trim();
  }

  async getConfirmPasswordErrorLabel(): Promise<string> {
    await this.webHelper.PerformWebELementAction(
      this.confirmPasswordField,
      WebElementAction.Click
    );
    await this.webHelper.PerformKeyboardEvent('Tab');
    return (await this.webHelper.GetTextAsync(this.confirmPasswordErrorLabel)).trim();
  }
}
