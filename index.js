
if (process.platform !== 'win32') {
  console.error('netuser module is only for windows platforms')
  return
}

var exec = require('child_process').exec
  , assert = require('assert')
  , os = require('os')

var RE_KEY_VAL_PAIR = /^(\S+(?: \S+)*)(?:\s{2,}(\S.*)?)?$/
  , RE_TITLE = /^User accounts for /
  , RE_CLOSING = /^The command completed successfully./
  , RE_HR = /^-+$/

// ANSI text-altering sequences
var yellowSeq = "\u001b[33m"
  , brightSeq = "\u001b[1m"
  , resetSeq  = "\u001b[0m"

module.exports = {
  usernames: usernames_depr,
  netUsers: netUsers_depr,
  netUser: netUser,
  list: usernames,
  get: getUser,
  getAll: getAllUsers
}

function usernames_depr(cb) {
  console.warn(yellowSeq + brightSeq +
    "DEPRECATED: usernames() - use list() instead" + resetSeq)
  return usernames(cb)
}

function netUsers_depr(cb) {
  console.warn(yellowSeq + brightSeq +
    "DEPRECATED: netUsers() - use list() instead" + resetSeq)
  return usernames(cb)
}

// Fetch only the list of usernames on the local system
function usernames(cb) {
  assert(typeof cb === 'function', 'Must provide callback')

  exec('net user', function(err, sout, serr) {
    if (err) cb(err)

    var lines = sout.split(os.EOL)
      , names = []
    for (var i = 0; i < lines.length; i++) {
      if (lines[i] === '') continue
      if (RE_TITLE.test(lines[i]) || RE_HR.test(lines[i])) continue
      if (RE_CLOSING.test(lines[i])) break
      names = names.concat(
        lines[i].split(/\s+/).filter(function(v){ return v !== '' })
      )
    }
    return cb(null, names)
  }).once('error', function(err) {
    console.error('Child process is blocked')
    cb(err)
  })
}

// Fetch the data of the named user, or fetch only the list of usernames
// on the local system if no username given
function netUser(userName, cb) {
  console.warn(yellowSeq + brightSeq +
    "DEPRECATED: netUser() - use get() or list() instead" + resetSeq)

  if (typeof cb !== 'function') {
    if (userName && typeof username === 'function') {
      cb = userName; userName = undefined
    }
  }

  if (!userName) return usernames(cb)
  return getUser(userName, cb)
}

// Fetch the data of the named user
function getUser(userName, cb) {
  assert(typeof userName === 'string' || userName instanceof String,
   'Must give username as a string')
  assert(typeof cb === 'function', 'Must provide callback')

  userName = userName.trim()
  assert(userName.length, 'Given username is empty')
  assert(userName.length <= 20, 'Given username is too long')
  // "The name of the user account can have as many as 20 characters."
  // - NET USER documentation

  // Guard against injection of change commands, and against illegal chars:
  // "User account names ... cannot be terminated by a period and they
  // cannot include..." (see regexp below)
  assert(userName.search(/[,"/\\\[\]:|<>+=;?*\x00-\x1F]/) == -1,
    'Illegal character in username "' + userName + '"')

  assert(userName.slice(-1) !== '.', 'Invalid name "' + userName + '"')

  // But guess what: a username can have embedded spaces!
  // Therefore, quotemarks are necessary
  exec('net user "' + userName + '"', function(err, sout, serr) {
    if (err) {
      if (serr.indexOf('The user name could not be found.') != -1)
        return cb(null, null)
      return cb(err)
    }
    var data
    try { data = parseUserInfo(sout) }
    catch (exc) { return cb(exc) }
    return cb(null, data)

  }).once('error', function(err) {
    console.error('Child process is blocked')
    cb(err)
  })
}

// Fetch data of all local user accounts
function getAllUsers(cb) {
  assert(typeof cb === 'function', 'Must provide callback')

  var list = []
  usernames(function(err, names) {
    if (err) return cb(err)
    return fetchNext()

    function fetchNext() {
      if (names.length == 0) return cb(null, list)

      exec('net user "' + names.shift() + '"', function(err, sout, serr) {
        if (err) return cb(err)

        try { list.push(parseUserInfo(sout)) }
        catch (exc) { return cb(exc) }
        return fetchNext()

      }).once('error', function(err) {
        console.error('Child process is blocked')
        cb(err)
      })
    }
  })
}

function parseUserInfo(text) {
  var lines = text.split(os.EOL)
    , info = {}
    , matches = null
    , j

  for (var i = 0; i < lines.length; i++) {
    if (lines[i] === '') continue
    if (RE_CLOSING.test(lines[i])) break
    matches = lines[i].match(RE_KEY_VAL_PAIR)
    //if (!matches) continue
    if (!matches) {
      console.warn('Unexpected line in output:', lines[i])
      continue
    }

    //console.log('netUser: matches[1] is', '"' + matches[1] + '"')
    // For values, currently we're getting undefined for matches[2] when
    // there's no value set, but it's *always* preceded by 2 or more spaces
    switch (matches[1]) {
      case "User name": info.user_name = matches[2]; break
      case "Full Name": info.full_name = matches[2]; break
      case "Comment":   info.comment = matches[2]; break
      case "User's comment": info.usr_comment = matches[2]; break
      case "Country code":
        info.country_code = ctryCode(matches[2]); break
      case "Account active":
        info.acct_active = xlateBool(matches[2]); break
      case "Account expires": 
        info.acct_expires = xlateTimespec(matches[2]); break
      case "Password last set":
        info.password_set = xlateTimespec(matches[2]); break
      case "Password expires":
        info.password_expires = xlateTimespec(matches[2]); break
      case "Password changeable":
        info.password_changeable = xlateTimespec(matches[2]); break
      case "Password required":
        info.password_required = xlateBool(matches[2]); break
      case "User may change password":
        info.password_can_change = xlateBool(matches[2]); break
      case "Workstations allowed":
        info.workstations = parseWorkstnList(matches[2]); break
      case "Logon script":   info.script_path = matches[2]; break;
      case "User profile":   info.profile = matches[2]; break;
      case "Home directory": info.home_dir = matches[2]; break;
      case "Last logon":
        info.last_logon = xlateTimespec(matches[2]); break
      case "Logon hours allowed":
        // logon_hours can have values "All" and "None"
        if (matches[2] === 'All') { info.logon_hours = null; break }
        info.logon_hours = []
        if (matches[2] === 'None') break
        info.logon_hours.push(matches[2])
        // Can be followed by multiple lines of timespans
        for (j = i + 1; j < lines.length; j++) {
          // Blank line means end of timespan entries
          if (lines[j] === '') break
          var parts = lines[j].split(/\s\s+/)
          // There is nothing but padding space prefixed to each line of
          // logon hours after the first; so, after splitting on space padding,
          // if the 1st element is not an empty string, we have overshot.
          if (parts[0]) break

          info.logon_hours.push(lines[j].trim())
        }
        i = j - 1; break

      // It seems that group names are always prefixed by '*'; this helps parse
      // them out, given that group names can be made up of words separated by
      // a space
      case "Local Group Memberships":
        info.local_groups = parseGroupList(matches[2])
        if (!info.local_groups || info.local_groups.length == 0) break
        for (j = i + 1; j < lines.length; j++) {
          if (lines[j] === '') break
          if (/^\s*\*/.test(lines[j]) === false) break
          info.local_groups = info.local_groups.concat(parseGroupList(lines[j]))
        }
        i = j - 1; break

      case "Global Group memberships":
        info.global_groups = parseGroupList(matches[2])
        if (!info.global_groups || info.global_groups.length == 0) break
        for (j = i + 1; j < lines.length; j++) {
          if (lines[j] === '') break
          if (/^\s*\*/.test(lines[j]) === false) break
          info.global_groups = info.local_global.concat(parseGroupList(lines[j]))
        }
        i = j - 1; break
    }
  }
  return info
}

function xlateBool(s) {
  switch (s) {
    case 'Yes': return true
    case 'No' : return false
  }
  // default: undefined
}

function xlateTimespec(s) {
  // Timespec format from 'net user' seen to follow 'm/d/yyy h:mm:ss'
  // when the value is not 'Never'
  if (s === 'Never') return null
  var t = new Date(s)
  if (t.toString() === 'Invalid Date') {
    console.warn("Invalid timespec in 'net user' output:", s)
    return null
  }
  return t
}

function ctryCode(s) {
  if (!s || s === '(null)') return null
  var matches = s.match(/^(\d{3})(?: .+)?$/)
  // Dev code - watch for unexpected errors
  if (!matches) {
    console.warn('Unexpected value for Country code:', s)
    return null
  }
  return matches[1]
  // Production code:
  //return matches ? matches[1] : null
}

function parseWorkstnList(s) {
  if (!s) return []
  else if (s === 'All') return null
  else return s.split(',')
}

function parseGroupList(s) {
  // debug note: saw empty value for "Local Group Memberships" for user "HelpAssistant";
  // also saw truncated names, and names jammed together (nothing but a '*' between
  // them), when several long-named groups were added to a user's info
  var l
  if (!s) l = []
  else {
    l = s.split(/\s*\*/g).filter(function(v){ return v !== '' })
    if (l.length) l[l.length - 1] = l[l.length - 1].trim()
    if (l[0] === 'None') l = []
  }
  return l
}

