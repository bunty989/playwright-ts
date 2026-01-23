export enum LocatorType {
  CssSelector = 'CssSelector',
  XPath = 'XPath',
  Id = 'Id',
  Text = 'Text'
}

export enum WebElementAction {
  Click = 'Click',
  EnterText = 'EnterText',
  Clear = 'Clear',
  Hover = 'Hover'
}

export enum DataType {
  // 👤 Person
  Name = 'Name',
  FirstName = 'FirstName',
  LastName = 'LastName',
  Gender = 'Gender',

  // 📧 Account
  Email = 'Email',
  Username = 'Username',
  Password = 'Password',

  // 📞 Phone
  Phone = 'Phone',
  Mobile = 'Mobile',

  // 🏠 Address (AU)
  Address = 'Address',
  Street = 'Street',
  City = 'City',
  State = 'State',
  Postcode = 'Postcode',
  Country = 'Country',

  // 🏢 Work
  Company = 'Company',
  JobTitle = 'JobTitle',

  // 🎂 Personal
  DateOfBirth = 'DateOfBirth',
  Age = 'Age',

  // 🌐 Technical
  UUID = 'UUID',
  URL = 'URL',
  IP = 'IP',
}
