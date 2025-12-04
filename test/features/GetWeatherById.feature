@Retry
Feature: Get WeatherById

@api
Scenario: Verify the Api response 200 for valid GetWeatherById request
	Given I have the endpoint '/data/2.5/weather' and the search param is 'q=Sydney' for GetWeatherById
	When I send a GET request to the GetWeatherById Url
	And I should get a response for the api call
	Then the response status code should be 200
	And the response should be within '1500' ms
	And the response should pass the schema for 'Response 200' for GetWeatherById
	And the value of the 'name' is 'Sydney' in the response
	And the value of the 'coord.lon' is '151.2073' in the response
	And the value of the 'coord.lat' is '-33.8679' in the response

@api
Scenario: Verify the Api response 401 for invalid GetWeatherById request
	Given I have the endpoint '/data/2.5/weather' and the search param is 'q=Sydney' for GetWeatherById
	When I send a GET request to the GetWeatherById Url without the api key
	And I should get a response for the api call
	Then the response status code should be 401
	And the response should be within '1500' ms
	And the response should pass the schema for 'Response 401' for GetWeatherById
	And the value of the 'cod' is '401' in the response
	And the value of the 'message' is 'Invalid API key. Please see https://openweathermap.org/faq#error401 for more info.' in the response