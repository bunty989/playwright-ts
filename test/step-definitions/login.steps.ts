// test/step-definitions/login.steps.ts
import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';

import { CustomWorld } from '../../framework/support/world';
import { LandingPage } from '../pages/landing.page';
import { CreateAccountPage } from '../pages/createAccount.page';
import { WebHelper } from '../../framework/playwrightHelpers/webHelper';
import { testConfig } from '../config/testConfig';

type WorldWithLogin = CustomWorld & {
  webHelper?: WebHelper;
  landingPage?: LandingPage;
  createAccountPage?: CreateAccountPage;
};

function getLandingPage(world: WorldWithLogin): LandingPage {
  if (!world.page) {
    throw new Error('Page is not initialized');
  }
  if (!world.landingPage) {
    world.landingPage = new LandingPage(world.page);
  }
  return world.landingPage;
}

function getCreateAccountPage(world: WorldWithLogin): CreateAccountPage {
  if (!world.page) {
    throw new Error('Page is not initialized');
  }
  if (!world.createAccountPage) {
    world.createAccountPage = new CreateAccountPage(world.page);
  }
  return world.createAccountPage;
}

Given('the browser is launched', function (this: WorldWithLogin) {
  if (!this.page) {
    throw new Error(
      'The browser page is not initialized. Ensure the Before hook created it.'
    );
  }
});

When('the user navigates to the app', 
  async function (this: WorldWithLogin) {
  if (!this.page) {
      throw new Error('Page is not initialized');
    }
    const url = testConfig.uiBaseUrl; 
    this.webHelper = new WebHelper(this.page);
    await this.webHelper?.GoTo(url);
  
});

Then(
  'the homepage should be displayed',
  async function (this: WorldWithLogin) {
    const landingPage = getLandingPage(this);

    await landingPage.waitForLoadingSpinnerToDisappear();
    const isDisplayed = await landingPage.landingPageIsDisplayed();
    expect(isDisplayed).toBe(true);
  }
);

When(
  'the user clicks on the {string} button',
  async function (this: WorldWithLogin, buttonName: string) {
    const landingPage = getLandingPage(this);

    await landingPage.waitForLoadingSpinnerToDisappear();

    if (buttonName === 'User') {
      await landingPage.clickUserBtn();
    } else {
      await landingPage.clickCreateNewAccount();
    }
  }
);

Then(
  'the user should be shown the new user creation page',
  async function (this: WorldWithLogin) {
    const createAccountPage = getCreateAccountPage(this);

    await createAccountPage.waitForHeaderTextToBeDisplayed();
  }
);


