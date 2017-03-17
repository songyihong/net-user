# net-user
The Windows NET USER command wrapped in JavaScript

## What Is That
`NET USER` is a sub-command of the
[`NET` command line tool](https://technet.microsoft.com/en-us/library/bb490718.aspx)
on Windows. If a username is included, and no change switches are used, it's
roughly equivalent to using `getent passwd <username>` on Unix/Linux, or
`id -P <username>` on macOS, then parsing and pretty-printing the results.
The output may not contain everything you could possibly want, but there's a lot.

## Query Only
The Windows command `NET USER` allows administrators to change settings on user
accounts.  
The current version of this module does not provide an interface for that; it
only retrieves information.

## Caveat: Privilege and Permission
If you try to use this module from an under-privileged account on a system that
has been security-hardened, you may see something like the following:
```sh
The command prompt has been disabled by your administrator.

Press any key to continue . . .
```
This means that a child process spawned by the module has been shot down, and so
you won't be able to get any results.

## Install

```sh
$ npm install net-user
```

## API
Assume the module is accessed like so:

```js
var nu = require('net-user')
```
### nu.usernames(cb)
Fetches the list of usernames for all accounts on the system.
- **`cb(err, list)`**: {function} Callback function.
  + `err`: {Error} if any.
  + `list`: {Array} An array of usernames as strings.

### nu.netUsers(cb)
Alias for `usernames(cb)`.

### nu.netUser([name,] cb)
Fetches the account information of the named user.
- **`name`**: {string} The username.  
  Optional. If not supplied, the call becomes an alias for `usernames(cb)`.  
  If supplied but contains invalid characters, an assertion will be thrown.
- **`cb(err, data)`**: {function} Callback function.
  + `err`: {Error} if any command error other than "No such user".
  + `data`: {object | Array}  
    If `name` was supplied and is the name of an account on the system, this is
    an object containing all properties listed in the Field Mapping table below.  
    If `name` was supplied but is not known by the system, this is `null`.

### nu.getAll(cb)
Fetches the account information of every user known by the system.
- **`cb(err, dataList)`**: {function} Callback function.
  + `err`: {Error} if any.
  + `dataList`: {Array} in which each element is an object as described for the
    `data` argument resulting from call to `netUser(name, cb)` (see above).

## Field Mapping
    | `netUser()` result property  |  type   | `NET USER` output label
    |------------------------------|---------|---------------------------|
      `user_name`                  | string  | `User name`
      `full_name`                  | string  | `Full Name`
      `comment`                    | string  | `Comment`
      `usr_comment`                | string  | `User's comment`
      `country_code`               | string  | `Country code`
      `acct_active`                | boolean | `Account active`
      `acct_expires`               | Date    | `Account expires`
      `password_set`               | Date    | `Password last set`
      `password_expires`           | Date    | `Password expires`
      `password_changeable`        | Date    | `Password changeable`
      `password_required`          | boolean | `Password required`
      `password_can_change`        | boolean | `User may change password`
      `workstations`               | Array   | `Workstations allowed`
      `script_path`                | string  | `Logon script`
      `profile`                    | string  | `User profile`
      `home_dir`                   | string  | `Home directory`
      `last_logon`                 | Date    | `Last logon`
      `logon_hours`                | Array   | `Logon hours allowed`
      `local_groups`               | Array   | `Local Group Memberships`
      `global_groups`              | Array   | `Global Group memberships`


## Notes per Field

  **`user_name`**  
    This will be the same as the username argument given to `netUser()`.
    Never empty!

  **`full_name`**  
  **`comment`**  
  **`usr_comment`**  
    If the corresponding account field is not set, the object property will be
    set to `undefined`.

  **`country_code`**  
    A three-digit string, or `null`. Refer to Microsoft documentation for the
    country code mapping.  
    If the corresponding account field is not set, the object property _usually_
    gets set to `'000'` (the corresponding value in the `NET USER` output is
    `000 (System Default)`).  
    The string `(null)` has been seen for this in `NET USER` output; in that
    case, this field is set to `null`.

  **`acct_expires`**  
  **`password_set`**  
  **`password_expires`**  
  **`password_changeable`**  
  **`last_logon`**  
    Any of the Date-type fields can be set to `null`; that corresponds to
    `Never` in the `NET USER` output.

  **`password_set`**  
    The timestamp when the password was _last_ successfully set.

  **`password_changeable`**  
    _Not_ a flag (see `password_can_change` for that). This is the timestamp
    when the password was last found to be changeable.
    (It's not clear how this is different from `password_set`, and the values
    of the two fields have always been seen to be the same in my tests.)
    
  **`workstations`**  
    If the value is `null`, it means the associated user is allowed to log on
    from any workstation in the local domain.
    (The corresponding value in the `NET USER` output is `All`.)
    Otherwise the field value will be an array of workstation names, possibly
    none.

  **`script_path`**  
  **`profile`**  
  **`home_dir`**  
    Like the other string fields above, the value of these fields may be (and
    usually are) `undefined`; but that doesn't mean there's no profile or home
    directory associated with the username. It only means that the creator of
    the account did not deviate from the default. If you're invested in
    identifying the default root location of one of these items, then it's up
    to you to find it. That's not impossible, but it varies by Windows version.  
    Good luck, Jim.

  **`logon_hours`**  
    If the value is `null`, it means there are _no restrictions on when_ the
    associated user is allowed to be logged on.
    (The corresponding value in the `NET USER` output is `All`.)
    Otherwise the field value will be an array of strings specifying timespans,
    possibly none.

  **`local_groups`**  
  **`global_groups`**  
    The value is an array of group names, possibly none.  
    Those who wish to use the elements of these arrays, heed this **warning**:  
    Sometimes the group names are **truncated** in `NET USER` output.  
    If the user account that you query is a member of more than two groups, and
    if even one of the groups has an especially long name, you will probably
    have this problem.  
    A Windows group name can have up to 256 characters. The display space set
    aside for the values in `NET USER` output is 44 columns, regardless of the
    number of columns configured for the terminal window. More than one group
    name can be displayed per line; if the first group name on a line is short,
    and there are more group names, the next group name is displayed on the same
    line, _even if it's too long too fit in the remaining space_. Furthermore,
    group names are never wrapped to the next line. Result: truncation. This is
    odd, because line wrapping _is_ applied to a set of names in another field
    of `NET USER` output (`Workstations allowed`), and no name is truncated there.


------

**License: MIT**

