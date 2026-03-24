@api @ignore
Feature: Post Amazon SQS

  As a client of the Amazon SQS API
  I want to reuse AWS SigV4 credentials fetched from a previous API call
  So that I can send a signed SQS request through this framework

  Scenario: Send a message to Amazon SQS using credentials captured from a previous API response
    Given I have the endpoint "/" for Amazon SQS
    And I have successfully captured AWS auth details from a previous API response for Amazon SQS
    And I have the request body for Amazon SQS
    When I send a POST request to the Amazon SQS Url
    And I should get a response for the api call
    Then the response status code should be 200
    And the response should be within '5000' ms
    And the response should pass the schema for "Response 200" for Amazon SQS
