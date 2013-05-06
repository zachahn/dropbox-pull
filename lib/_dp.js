var fs = require('fs')
var path = require('path')
var readline = require('readline')

var async = require('async')
var Dropbox = require('dropbox')
var mkdirp = require('mkdirp')
var nconf = require('nconf')
var remove = require('remove')

var dp = require('./')

var directory = function (d) {
  return d ? path.join(process.cwd(), d) : process.cwd()
}

module.exports = {}

module.exports.init = function (d) {
  var dir = directory(d)
  var config = path.join(dir, '.dpconfig')

  fs.exists(dir, function (exists) {
    if (exists) {
      fs.stat(dir, function (err, dirstat) {
        if (err) return console.error(err)

        if (dirstat.isDirectory()) {
          return console.error(dir, 'already exists')
        }
      })
    }
    else {
      nconf.file(config)

      async.series([
        function (next) {
          dp.cliAuth.getAppKeyAndSecret(nconf, next)
        },
        function (next) {
          dp.cliAuth.authenticate(nconf, next)
        },
        function (next) {
          // make directory, create config file
          dp.helpers.initDirectory(nconf, dir, function (err) {
            if (err) return next(err)
            console.log('initialized directory in', dir)
            next()
          })
        }
      ], function (err) {
        if (err) console.error(err)
      })
    }
  })
}

module.exports.pull = function (d) {
  var dir = directory(d)
  var config = path.join(dir, '.dpconfig')
  nconf.file(config)

  var client = new Dropbox.Client({
    "key": nconf.get('key'),
    "secret": nconf.get('secret'),
    "token": nconf.get('token'),
    "tokenSecret": nconf.get('tokenSecret'),
    "sandbox": true
  })

  var commitChanges = function (err, changes) {
    if (err) return console.error(err)

    var diff = changes.changes;

    async.series([
      function (next) {
        if (changes.blankSlate) {
          dp.helpers.resetDirectory(nconf, dir, next)
        }
        else {
          next()
        }
      },
      function (next) {
        // do the `changes.shouldPullAgain` stuff
        next()
      },
      function (next) {
        // do the file system stuff (and pull appropriate files)
        var fixEntry = dp.client.createFixEntry(client, dir)
        async.eachSeries(diff, fixEntry, function (err) {
          next(err)
        })
      },
      function (done) {
        // write updated config file back to disk
        nconf.set('cursor', changes.cursor())
        nconf.save(done)
      }
    ],
    function (err) {
      if (err) return console.error(err)
    })
  }

  client.authenticate(function (err, client) {
    if (err) return console.error(err)

    var cursor = nconf.get('cursor')
    var newCursor = nconf.get('cursor')

    if (cursor) {
      client.pullChanges(cursor, commitChanges)
    }
    else {
      client.pullChanges(commitChanges)
    }
  })
}

module.exports.status = function (d) {
}

module.exports.diff = function (d) {
}