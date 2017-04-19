var exec = require('child_process').exec
  , os = require('os')
  , assert = require('assert')
  , expect = require('chai').expect
  , netUser = require('../')

var propXRef = {
  "User name": "user_name",
  "Full Name": "full_name",
  "Comment":   "comment",
  "User's comment":  "usr_comment",
  "Country code":    "country_code",
  "Account active":  "acct_active",
  "Account expires": "acct_expires",
  "Password last set":   "password_set",
  "Password expires":    "password_expires",
  "Password changeable": "password_changeable",
  "Password required":   "password_required",
  "User may change password": "password_can_change",
  "Workstations allowed": "workstations",
  "Logon script":   "script_path",
  "User profile":   "profile",
  "Home directory": "home_dir",
  "Last logon":     "last_logon",
  "Logon hours allowed": "logon_hours",
  "Local Group Memberships": "local_groups",
  "Global Group memberships": "global_groups"
}
var RE_TITLE = /^User accounts for /
  , RE_CLOSING = /^The command /
  , RE_HR = /^-+$/

describe('net-user module', function() {
  it('should export functions: netUsers, usernames, netUser, getAll', function() {
    expect(netUser.netUsers).to.be.a('function')
    expect(netUser.usernames).to.be.a('function')
    expect(netUser.netUser).to.be.a('function')
    expect(netUser.getAll).to.be.a('function')
  })
})

function reconstructDateStr(d) {
  var calDate = [ d.getMonth() + 1, d.getDate(), d.getFullYear() ].join('/')
  var hour = d.getHours()
    , min = d.getMinutes()
    , sec = d.getSeconds()
    , time, merid

  if (hour < 12) {
    merid = 'AM'
    if (hour == 0) hour = 12
  }
  else {
    merid = 'PM'
    if (12 != hour) hour -= 12
  }
  if (min < 10) min = '0' + min
  if (sec < 10) sec = '0' + sec
  time = [ hour, min, sec ].join(':')

  return [ calDate, time, merid ].join(' ')
}

function compareNetUsers(apiFunc, cb) {
  exec('net users', function(err, sout, serr) {
    var lines = sout.split(os.EOL).map(function(s) {
      if (RE_TITLE.test(s) || RE_HR.test(s) || RE_CLOSING.test(s))
        return undefined
      return s.trim().replace(/\s{3,}/g, '  ')
    }).filter(function(s) { return s ? true : false })

    var names = lines.join('  ')
    apiFunc(function(err, list) {
      if (err) return done(err)
      expect(list.join('  ')).to.equal(names)
      cb()
    })
  }).once('error', function(err) {
    console.error('Child process is blocked')
    cb(err)
  })
}

describe('net-user function netUsers', function() {
  it('should provide a list of names that match those in output of NET USERS', function(done) {
    compareNetUsers(netUser.netUsers, done)
  })
})

describe('net-user function usernames', function() {
  it('should provide a list of names that match those in output of NET USERS', function(done) {
    compareNetUsers(netUser.usernames, done)
  })
})

function compareUserInfo(nm, data, cb) {
  assert(nm && typeof nm == 'string', 'Bad nm arg: "' + nm + '"')

  exec('net user ' + nm, function(err, sout, serr) {
    var lines = sout.split(os.EOL).map(function(s) {
      if (RE_CLOSING.test(s)) return undefined
      return s.trimRight().replace(/\s{3,}/g, '  ')
    }).filter(function(s) { return s ? true : false })

      var i, j, k
      for (i = 0; i < lines.length; i++) {
        // Note that we filtered out the blank lines above
        var pair = lines[i].split(/\s\s+/) // HERE'S THE SOURCE OF ERROR FOR 1st GROUPS LINE
        var apiVal = data[propXRef[pair[0]]]
        switch (pair[0]) {
          // To be compared directly
          case "User name":
          case "Full Name":
          case "Comment":
          case "User's comment":
          case "Logon script":
          case "User profile":
          case "Home directory":
            expect(pair[1]).to.equal(apiVal)
            break

          case "Country code":
            if (!pair[1] || pair[1] === '(null)')
              expect(apiVal).to.be.null
            else {
              // Country code is 3 digits
              expect(apiVal).to.match(/^\d{3}$/)
              // Value possibly followed by something, so check only prefix
              expect(pair[1].indexOf(apiVal)).to.equal(0)
            }
            break

          // To be compared by conversion of boolean to string
          case "Account active":
          case "Password required":
          case "User may change password":
            if (pair[1] === 'Yes') expect(apiVal).to.be.true
            else if (pair[1] === 'No') expect(apiVal).to.be.false
            else expect(apiVal).to.be.undefined
            break

          // To be compared by Date object conversion
          case "Account expires": 
          case "Password last set":
          case "Password expires":
          case "Password changeable":
          case "Last logon":
            if (pair[1] ==='Never') expect(apiVal).to.be.null
            //else expect(new Date(pair[1]).toString()).to.equal(apiVal.toString())
            //else expect(pair[1]).to.equal(reconstructDateStr(apiVal))
            // Wobbly time value parsings!!! Sometimes off by 1000ms. Can't trust.
            // It's wrong that this is needed, but it works:
            else expect(Math.abs(Date.parse(pair[1]) - apiVal.getTime())).to.be.at.most(1000)
            break

          case "Workstations allowed":
            if (pair[1] === 'All') expect(apiVal).to.be.null
            else {
              expect(apiVal).to.be.instanceof(Array)
              if (!pair[1]) expect(apiVal).to.have.lengthOf(0)
              else expect(apiVal.join(',')).to.equal(pair[1].trim())
            }
            break

          // Might involve multiple lines...
          // logon_hours can have values "All" and "None"
          case "Logon hours allowed":
            if (pair[1] === 'All') { expect(apiVal).to.be.null; break }
            expect(apiVal).to.be.instanceof(Array)
            if (pair[1] === 'None') { expect(apiVal).to.have.lengthOf(0); break }
            expect(apiVal[0]).to.equal(pair[1])
            
            for (j = i + 1, k = 1; j < lines.length; j++) {
              pair = lines[j].split(/\s\s/)
              // For a timespan line, pair will be ['', timespanExpr]
              // For the next property line, pair will be [label, '' | value]
              if (pair[0]) break
              expect(apiVal[k]).to.equal(pair[1])
              k++
            }
            i = j - 1; break

          // List of star-prefixed items; might be multiple lines
          case "Local Group Memberships":
          case "Global Group memberships":
            expect(apiVal).to.be.instanceof(Array)
            if (pair[1] === '*None') { expect(apiVal).to.have.lengthOf(0); break }

            // A correction for splitting on multiple spaces (see top of func),
            // where such spacing may be separating group names:
            while (pair.length > 2) pair[1] += '  ' + pair.pop()

            for (j = i + 1; j < lines.length; j++) {
              if (/^\s\s\*/.test(lines[j]) === false) break
              pair[1] += lines[j].replace(/\s*\*/g, '  *')
            }
            expect('*' + apiVal.join('  *')).to.equal(pair[1])
            i = j - 1
            break
        }
      }
      cb()
  }).once('error', function(err) {
    console.error('Child process is blocked')
    cb(err)
  })
}

describe('net-user function netUser', function() {
  var validNames

  it('should provide set of fields that corresponds to output of NET USER <name>', function(done) {

    // Get the list of users on the system, and pick the first one as test subject
    netUser.usernames(function(err, list) {
      if (err) return done(err)
      expect(list.length).to.be.at.least(1)
      validNames = list // Save them for the next test!
      netUser.netUser(list[0], function(err, data) {
        compareUserInfo(list[0], data, done)
      })
    })
  })

  it('should give null result for username that has no account on the system', function(done) {
    var tempName
    do {
      tempName = (new Date).getTime().toString()
    } while (validNames && validNames.indexOf(tempName) !== -1)

    netUser.netUser(tempName, function(err, data) {
      if (err) return done(err)
      expect(data).to.be.null
      done()
    })
  })
})

describe('net-user function getAll', function() {
  it('should provide an array of objects where each set of fields corresponds '
     + 'to output of NET USER <name> for each user account on system', function(done) {

    this.timeout(0) // because lots of work to do!
    netUser.getAll(function(err, data) {
      netUser.usernames(function(err, list) {
        if (err) return done(err)
        var i = 0

        function next(err) {
          if (err) return done(err)
          if (i === list.length) return done()
          compareUserInfo(list[i], data[i], next)
          i++
        }

        next()
      })
    })
  })
})

