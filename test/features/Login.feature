Feature: Login

	As a visitor
	I want to see the landing page
	So that I can navigate to the create new user page

@ui
Scenario: User navigates to the homepage
    Given the browser is launched
	When the user navigates to the app
    Then the homepage should be displayed

@ui
Scenario: User logs in
	Given the browser is launched
	When the user navigates to the app
	And the user clicks on the "User" button
	And the user clicks on the "CreateNewUser" button
	Then the user should be shown the new user creation page