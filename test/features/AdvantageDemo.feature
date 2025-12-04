Feature: AdvantageDemo

    As a user
    I want to see validation messages on the create new user form
    So that I know what to correct

@ui
Scenario: Check error messages for Username, Email, Password & Confirm Password fields when all are empty
	Given I navigate to the landing page of the app
	When I see the page is loaded
    And I click the user button to create new user
    And I dont enter anything to username and email fields
    And I dont enter anything to password and confirm password fields
    Then I see the 'Username field is required' error message is displayed
    And I see the 'Email field is required' error message is displayed
    And I see the 'Password field is required' error message is displayed
    And I see the 'Confirm password field is required' error message is displayed

@ui
Scenario: Check error message are not displayed for Username, Email, Password & Confirm Password fields when they are filled
    Given I navigate to the landing page of the app
	When I see the page is loaded
    And I click the user button to create new user
    And I enter 'admin' to username field
    And I enter 'admin@gmail.com' to email field
    And I enter 'Admin123' to password field
    And I enter 'Admin123' to confirm password field
    Then I dont see any error message for 'username' field
    And I dont see any error message for 'email' field
    And I dont see any error message for 'password' field
    And I dont see any error message for 'confirm password' field