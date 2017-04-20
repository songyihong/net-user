# net-user
The Windows `NET USER` command wrapped in JavaScript

## Background
[`NET USER`](https://technet.microsoft.com/en-us/library/cc771865.aspx)
is a sub-command of the `NET` command line tool that is provided for shell-based
management of user accounts on Windows. If a username is specified, and no
change switches are used, it's roughly equivalent to using
```sh
getent passwd <username>
```
on Unix/Linux, or
```sh
id -P <username>
```
on macOS, then displaying formatted results.
The output may not contain everything you could possibly want, but there's a lot.

## Query Only
The Windows command `NET USER` also allows administrators to create, change,
and delete user accounts. The current version of this module does not provide an
interface for that; it only retrieves information.

## Caveat: Privilege and Permission
If you try to use this module from an under-privileged account on a system that
has been security-hardened, you may see something like the following:
<pre>
The command prompt has been disabled by your administrator.

Press any key to continue . . .
</pre>
... or you may see nothing, because the callback is never called.
This means that the child process spawned by the module has been killed, and so
you won't be able to get any results.

## Install

<pre>
C:\Users\myUser><b>npm install net-user</b>
</pre>

## Usage
```js
var netUser = require('net-user')
```

## API

### netUser.list(callback)
Fetches the list of usernames for all accounts on the system, and passes it
back through the `callback` function.
- **`callback`**: {Function}
  + `error`: {Error | `null`}
  + `data`: {Array} array of strings, if no error

### netUser.get(name, callback)
Fetches the account information of the named user, and passes it back through
the `callback` function.
- **`name`**: {string} The username.  
  If not given, or it does not conform to Windows account naming rules, an
  assertion will be thrown.
- **`callback`**: {Function}  
  + `error`: {Error | `null`} if any command error other than "No such user".
  + `data`: {Object | `null`}  
    If `name` matches an account on the system, this is an object containing
    all properties listed in the Field Mapping table below.  
    If `name` is not known by the system, this is `null`.

### netUser.getAll(callback)
Fetches the account information of every user known by the system, and passes it
back through the `callback` function.
- **`callback`**: {Function}
  + `error`: {Error | `null`}
  + `dataList`: {Array} in which each element is an object containing
    all properties listed in the Field Mapping table below.

### netUser.netUser([name,] callback)
*Deprecated - use `get()` or `list()` instead*.  
If name supplied, becomes alias for `netUser.get(name, callback)`.  
If no name given, becomes alias for `netUser.list(callback)`.

### netUser.netUsers(callback)
*Deprecated*. Alias for `netUser.list(callback)`.

### netUser.usernames(callback)
*Deprecated*. Alias for `netUser.list(callback)`.

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
    This will be the same as the username argument given to `get()`.
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

