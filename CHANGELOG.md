# net-user
The Windows `NET USER` command wrapped in JavaScript

## 1.1.0 / 2017-04-20
- **New functions:** `list`, `get`
- **Deprecated:** `netUser`, `netUsers`, `usernames`
- **Test Suite:**  
  Old version used the misguided approach of re-implementing the module functions
  to get comparable results, for the sake of *verification*, for lack of other
  reasonable means to do that. New version does only *validation*, from the
  standpoint of one who has read the API documentation, but knows nothing about
  how to implement the functionality. It also adds more thorough testing of
  error cases.
- Updated README
- Added CHANGELOG

