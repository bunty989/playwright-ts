@api
Feature: GetWeather API

  As a client of the weather API
  I want to call the GetWeather endpoint
  So that I can verify its responses and schema

  Scenario: Successful GetWeather call returns 200 and valid schema
    Given I have the endpoint "/data/2.5/weather" and the search param is "lat=33.44;lon=-94.04" for GetWeather
    When I send a GET request to the GetWeather Url
    And I should get a response for the api call
    Then the response status code should be 200
    And the response should pass the schema for "200" for GetWeather
    And the response should be within '1500' ms
    And the response should pass the schema for "200" for GetWeather
    And the value of the 'name' is 'Texarkana' in the response
    And the value of the 'coord.lon' is '-94.04' in the response
    And the value of the 'coord.lat' is '33.44' in the response
    

  Scenario: GetWeather without API key returns 401 and valid error schema
    Given I have the endpoint "/data/2.5/weather" and the search param is "lat=33.44;lon=-94.04" for GetWeather
    When I send a GET request to the GetWeather Url without the api key
    And I should get a response for the api call
    Then the response status code should be 401
    And the response should be within '1500' ms
    And the response should pass the schema for "401" for GetWeather
    And the value of the 'cod' is '401' in the response
	  And the value of the 'message' is 'Invalid API key. Please see https://openweathermap.org/faq#error401 for more info.' in the response
