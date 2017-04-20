var assert = require('assert')
  , os = require('os')
  , expect = require('chai').expect
  , mod = require('../')

function dummyFunc(err, data) {
  assert(false, 'This dummy function should never get called!')
}

if (process.platform !== 'win32') {
  console.error('This module is only meant for Windows platforms.\n' +
    'Aborting tests.\n');
  return
}

describe('net-user module', function() {
  it('should export functions: netUsers, usernames, netUser, list, get, getAll',
  function() {
    expect(mod.netUsers).to.be.a('function')
    expect(mod.usernames).to.be.a('function')
    expect(mod.netUser).to.be.a('function')
    expect(mod.list).to.be.a('function')
    expect(mod.get).to.be.a('function')
    expect(mod.getAll).to.be.a('function')
  })

  var unknownName = "A B C D E F G H I J" // Actually valid! But unlikely
    , emptyArgs   = [ undefined, null, '', new String() ]
    , invalidArgs = [ 42, true, {}, [] ]
    // This will be the results returned by mod.list(), used throughout the suite:
    , refList
    // RegExps
    , RE_BADCHARS = /[,"/\\\[\]:|<>+=;?*\x00-\x1F]/
    , RE_ENDPERIOD = /\.$/
    , RE_ASSERTION = /AssertionError:/

  // Below, 'type' refers to the string value to be passed to chai for validation
  // of the actual field value (when there is one, or when noValueOK == false)
  var fieldMap = {
    user_name: {
      type: 'string',
      noValueOK: false
    },
    full_name: {
      type: 'string',
      noValueOK: true
    },
    comment: {
      type: 'string',
      noValueOK: true
    },
    usr_comment: {
      type: 'string',
      noValueOK: true
    },
    country_code: {
      type: 'string',
      noValueOK: true
    },
    acct_active: {
      type: 'boolean',
      noValueOK: false
    },
    acct_expires: {
      type: 'date',
      noValueOK: true
    },
    password_set: {
      type: 'date',
      noValueOK: true
    },
    password_expires: {
      type: 'date',
      noValueOK: true
    },
    password_changeable: {
      type: 'date',
      noValueOK: true
    },
    password_required: {
      type: 'boolean',
      noValueOK: false
    },
    password_can_change: {
      type: 'boolean',
      noValueOK: false
    },
    workstations: {
      type: 'array',
      noValueOK: true
    },
    script_path: {
      type: 'string',
      noValueOK: true
    },
    profile: {
      type: 'string',
      noValueOK: true
    },
    home_dir: {
      type: 'string',
      noValueOK: true
    },
    last_logon: {
      type: 'date',
      noValueOK: true
    },
    logon_hours: {
      type: 'array',
      noValueOK: true
    },
    local_groups: {
      type: 'array',
      noValueOK: false
    },
    global_groups: {
      type: 'array',
      noValueOK: false
    }
  }

  describe('list() call', function() {

    // Here the reference data is collected, as a side effect of the test; if
    // there are no localgroups defined, we abort the whole test suite
    before(function(done) {

      mod.list(function(err, data) {
        if (err) return done(err)
        expect(data).to.be.instanceof(Array)
        if (data.length == 0) {
          console.warn(
            'NO LOCAL USERS DEFINED ON THIS SYSTEM!\n' +
            'NO MEANINGFUL TESTS CAN BE DONE, SO TEST SUITE WILL BE ABORTED.\n' +
            'SORRY!'
          );
          process.exit()
        }
        refList = data
        done()
      })
    })

    it('should pass back an array of only nonempty strings through the callback',
    function() {
      // This test includes what before() started
      expect(refList).to.be.an('array')
      for (var i = 0; i < refList.length; i++) {
        expect(refList[i]).to.be.a('string').that.is.not.empty
      }
    })

    it('should throw an assertion if no callback given', function() {
      expect(function(){ mod.list() }).to.throw(Error, RE_ASSERTION)
      expect(function(){ mod.list(refList[0]) }).to.throw(Error, RE_ASSERTION)
      for (var i = 0; i < invalidArgs.length; i++) {
        expect(function(){ mod.list(invalidArgs[i]) }).to.throw(Error, RE_ASSERTION)
      }
    })

    it('each element should conform to MS rules for user names', function() {
      // "User account names are limited to 20 characters... In addition,
      // account names cannot be terminated by a period and they cannot include
      // commas or any of the following printable characters:
      // ", /, \, [, ], :, |, <, >, +, =, ;, ?, *.  Names also cannot include
      // characters in the range 1-31, which are nonprintable." - MSDN
      // See RE_BADCHARS and RE_ENDPERIOD declarations at top of file.
      for (var i = 0; i < refList.length; i++) {
        var uname = refList[i]
        expect(uname.length).to.be.at.most(20)
        expect(uname).to.not.match(RE_BADCHARS).and.not.match(RE_ENDPERIOD)
      }
    })
  })

  // This gets used by tests of get() and getAll()
  function validateUserData(data, userName) {
    expect(data).to.be.an('object')
    if (userName)
      expect(data).to.have.property('user_name', userName)
    else {
      expect(data).to.have.property('user_name').that.is.a('string')
        .that.is.not.empty
      expect(refList.indexOf(data.user_name)).to.not.equal(-1)
    }

    for (var fieldName in fieldMap) {
      if (fieldName === 'user_name') continue // Already validated above
      expect(data).to.have.property(fieldName)

      var item = data[fieldName]
      if ((item === undefined || item === null) &&
          fieldMap[fieldName].noValueOK) continue

      expect(item).to.be.a(fieldMap[fieldName].type)

      switch (fieldMap[fieldName].type) {
        case 'string':
          expect(item.trim()).to.not.be.empty
          break
        case 'date':
          expect(item.toString()).to.not.equal('Invalid Date')
          break
        case 'array':
          for (var i = 0; i < item.length; i++)
            expect(item[i]).to.be.a('string').that.is.not.empty
        //case 'boolean': // Nothing to test
      }
    }

    for (var fld in data) {
      assert(fieldMap[fld], 'Unrecognized field in user data: ' + fld)
    }
  }

  describe('get() call', function() {

    it('should throw an assertion if name is empty, not given, or not a string',
    function() {
      expect(function(){ mod.get() }).to.throw(Error, RE_ASSERTION)
      expect(function(){ mod.get(dummyFunc) }).to.throw(Error, RE_ASSERTION)
      expect(function(){ mod.get(null) }).to.throw(Error, RE_ASSERTION)
      expect(function(){ mod.get(null, dummyFunc) }).to.throw(Error, RE_ASSERTION)

      for (var i = 0; i < invalidArgs.length; i++) {
        expect(function(){ mod.get(invalidArgs[i], dummyFunc) })
          .to.throw(Error, RE_ASSERTION)
      }
    })

    it('should throw an assertion if given name does not conform to MS rules',
    function() {
      expect(function(){ mod.get('ABCDEFGHIJ_0123456789', dummyFunc) })
        .to.throw(Error, RE_ASSERTION) // too long
      expect(function(){ mod.get('Q: Are We Not Men?', dummyFunc) })
        .to.throw(Error, RE_ASSERTION) // illegal characters
      // Try to exploit command injection:
      expect(function(){ mod.get('Administrator" /comment:"Belong To Us', dummyFunc) })
        .to.throw(Error, RE_ASSERTION) // also illegal characters
      expect(function(){ mod.get('Guest.', dummyFunc) })
        .to.throw(Error, RE_ASSERTION) // ends with a period
    })

    it('should throw an assertion if no callback given', function() {
      expect(function(){ mod.get(refList[0]) }).to.throw(Error, RE_ASSERTION)
    })

    it('should pass back null through the callback if given name is not known',
    function(done) {
      mod.get(unknownName, function(err, data) {
        if (err) return done(err)
        expect(data).to.be.null
        done()
      })
    })

    it('should pass back valid data for any username defined on the system',
    function(done) {

      function nextUser(i) {
        if (i >= refList.length) return done()
        mod.get(refList[i], function(err, data) {
          if (err) return done(err)
          validateUserData(data, refList[i])

          return nextUser(i + 1)
        })
      }

      nextUser(0) // Kickoff
    })
  })

  describe('getAll() call', function() {

    it('should throw an assertion if no callback given', function() {
      expect(function(){ mod.getAll() }).to.throw(Error, RE_ASSERTION)
      expect(function(){ mod.getAll(refList[0]) }).to.throw(Error, RE_ASSERTION)
      for (var i = 0; i < invalidArgs.length; i++) {
        expect(function(){ mod.getAll(invalidArgs[i]) }).to.throw(Error, RE_ASSERTION)
      }
    })

    it('should pass back an array of only valid object elements like that from get()',
    function(done) {
      this.timeout(0) // because lots of work to do!
      mod.getAll(function(err, data) {
        if (err) return done(err)
        expect(data).to.be.an('array').with.lengthOf(refList.length)
        for (var i = 0; i < data.length; i++)
          validateUserData(data[i])

        done()
      })
    })
  })
})

