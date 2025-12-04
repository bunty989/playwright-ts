// test/step-definitions/advantageDemo.steps.ts
import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';

import { CustomWorld } from '../../framework/support/world';
import { LandingPage } from '../pages/landing.page';
import { CreateAccountPage } from '../pages/createAccount.page';
import { WebHelper } from '../../framework/playwrightHelpers/webHelper';
import { testConfig } from '../config/testConfig';

type WorldWithUi = CustomWorld & {
  webHelper?: WebHelper;
  landingPage?: LandingPage;
  createAccountPage?: CreateAccountPage;
  errorLabels?: string[];
  allErrorLabels?: string[];
};

function getLandingPage(world: WorldWithUi): LandingPage {
  if (!world.page) {
    throw new Error('Page is not initialized');
  }
  if (!world.landingPage) {
    world.landingPage = new LandingPage(world.page);
  }
  return world.landingPage;
}

function getCreateAccountPage(world: WorldWithUi): CreateAccountPage {
  if (!world.page) {
    throw new Error('Page is not initialized');
  }
  if (!world.createAccountPage) {
    world.createAccountPage = new CreateAccountPage(world.page);
  }
  return world.createAccountPage;
}

Given(
  'I navigate to the landing page of the app',
  async function (this: WorldWithUi) {
    if (!this.page) {
      throw new Error('Page is not initialized');
    }

    const url = testConfig.uiBaseUrl;
    this.webHelper = new WebHelper(this.page);
    await this.webHelper?.GoTo(url);
  }
);

When(
  'I see the page is loaded',
  async function (this: WorldWithUi) {
    const landingPage = getLandingPage(this);

    await landingPage.waitForLoadingSpinnerToDisappear();
    const isDisplayed = await landingPage.landingPageIsDisplayed();
    expect(isDisplayed).toBe(true);
  }
);

When(
  'I click the user button to create new user',
  async function (this: WorldWithUi) {
    const landingPage = getLandingPage(this);
    const createAccountPage = getCreateAccountPage(this);

    await landingPage.clickUserBtn();
    await landingPage.clickCreateNewAccount();
    await createAccountPage.waitForHeaderTextToBeDisplayed();
  }
);

When(
  'I dont enter anything to username and email fields',
  async function (this: WorldWithUi) {
    const createAccountPage = getCreateAccountPage(this);

    this.errorLabels = this.errorLabels ?? [];

    const usernameError = await createAccountPage.getUserNameErrorLabel();
    const emailError = await createAccountPage.getEmailErrorLabel();

    this.errorLabels.push(usernameError, emailError);
  }
);

When(
  'I dont enter anything to password and confirm password fields',
  async function (this: WorldWithUi) {
    const createAccountPage = getCreateAccountPage(this);

    this.errorLabels = this.errorLabels ?? [];

    const passwordError = await createAccountPage.getPasswordErrorLabel();
    const confirmError = await createAccountPage.getConfirmPasswordErrorLabel();

    this.errorLabels.push(passwordError, confirmError);
  }
);

Then(
  'I see the {string} error message is displayed',
  function (this: WorldWithUi, errorMessage: string) {
    const collected = this.errorLabels ?? [];

    // Same idea as original C#: use the first word as "key"
    const errorKey = errorMessage.split(' ')[0];
    const selected = collected.find(
      (label) => label && label.includes(errorKey)
    );

    expect(selected).toBe(errorMessage);
  }
);

When(
  'I enter {string} to username field',
  async function (this: WorldWithUi, userName: string) {
    const createAccountPage = getCreateAccountPage(this);
    await createAccountPage.enterUserName(userName);
  }
);

When(
  'I enter {string} to email field',
  async function (this: WorldWithUi, email: string) {
    const createAccountPage = getCreateAccountPage(this);
    await createAccountPage.enterEmail(email);
  }
);

When(
  'I enter {string} to password field',
  async function (this: WorldWithUi, password: string) {
    const createAccountPage = getCreateAccountPage(this);
    await createAccountPage.enterPassword(password);
  }
);

When(
  'I enter {string} to confirm password field',
  async function (this: WorldWithUi, confirmPassword: string) {
    const createAccountPage = getCreateAccountPage(this);

    await createAccountPage.enterConfirmPassword(confirmPassword);

    const labels: string[] = [];
    labels.push(await createAccountPage.getUserNameErrorLabel());
    labels.push(await createAccountPage.getEmailErrorLabel());
    labels.push(await createAccountPage.getPasswordErrorLabel());
    labels.push(await createAccountPage.getConfirmPasswordErrorLabel());

    this.allErrorLabels = labels;
  }
);

Then(
  'I dont see any error message for {string} field',
  function (this: WorldWithUi, fieldName: string) {
    const labels = this.allErrorLabels ?? [];
    const lowerField = fieldName.toLowerCase();

    const selected = labels.find(
      (label) => label && label.toLowerCase().includes(lowerField)
    );

    // This mirrors the original C# logic.
    expect(selected?.toLowerCase()).toBe(lowerField);
  }
);
