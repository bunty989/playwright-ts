@api @test
Feature: GraphQL Countries API

  As a client of a GraphQL API
  I want to submit a GraphQL query through the framework
  So that I can validate GraphQL responses using the same API test flow

  Scenario: Successful country query returns 200 and valid schema
    Given I have the endpoint "/graphql" for GraphQL Countries
    And I have the request body for GraphQL Countries
    When I send a POST request to the GraphQL Countries Url
    And I should get a response for the api call
    Then the response status code should be 200
    And the response should be within '5000' ms
    And the response should pass the schema for "Response 200" for GraphQL Countries
    And the value of the 'data.country.code' is 'AU' in the response
    And the value of the 'data.country.name' is 'Australia' in the response
    And the value of the 'data.country.capital' is 'Canberra' in the response
    And the value of the 'data.country.currency' is 'AUD' in the response
    And the value of the 'data.country.continent.name' is 'Oceania' in the response
