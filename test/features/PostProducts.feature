
Feature: Post Products

 @api
  Scenario: Verify the Api response 201 for valid Post Products request
	Given I have the endpoint 'products' for Post Products
	And I have the request body for Post Products
	When I send a POST request to the Post Products Url
	And I should get a response for the api call
	Then the response status code should be 201
	And the response should be within '1500' ms
	And the response should pass the schema for 'Response 201' for Post Products
	And the value of the 'title' is 'Omega' in the response
	And the value of the 'price' is '0.1' in the response
	And the value of the 'description' is 'Book' in the response
	And the value of the 'category' is 'Book' in the response
	And the value of the 'image' is 'http://example.com' in the response
