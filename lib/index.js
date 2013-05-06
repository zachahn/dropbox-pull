var fs = require('fs')
var path = require('path')
var readline = require('readline')

var async = require('async')
var Dropbox = require('dropbox')
var mkdirp = require('mkdirp')
var nconf = require('nconf')
var remove = require('remove')

var dp = {}

dp.cliAuth = {}
dp.helpers = {}
dp.client = {}

dp.cliAuth.getAppKeyAndSecret = function (nconf, done) {
  var prompt = readline.createInterface({ input: process.stdin, output: process.stdout })

  prompt.question('app key: ', function (key) {
    prompt.question('app secret: ', function (secret) {
      nconf.set('key', key)
      nconf.set('secret', secret)

      prompt.close()
      done(null)
    })
  })
}

dp.cliAuth.authDriver = {
  url: function() { return ""; },
  doAuthorize: function (authUrl, token, tokenSecret, done) {
    var prompt = readline.createInterface({ input: process.stdin, output: process.stdout })

    prompt.question("visit the following in a browser, then press enter:\n  " + authUrl + "\n", function (okay) {
      prompt.close()
      done()
    })
  }
}

dp.cliAuth.authenticate = function (nconf, done) {
  var client = new Dropbox.Client({
    "key": nconf.get('key'),
    "secret": nconf.get('secret'),
    "sandbox": true
  })

  client.authDriver(dp.cliAuth.authDriver)

  client.authenticate(function (err, client) {
    nconf.set('token', client.oauth.token)
    nconf.set('tokenSecret', client.oauth.tokenSecret)
    done(err)
  })
}

dp.helpers.initDirectory = function (nconf, absdir, done) {
  mkdirp(absdir, function (err) {
    if (err) return done(err)
    nconf.save(done)
  })
}

dp.helpers.resetDirectory = function (nconf, absdir, done) {
  remove(absdir, function (err) {
    if (err) return done(err)
    dp.helpers.initDirectory(nconf, absdir, done)
  })
}

dp.client.authenticate = function (nconf, done) {
  var CLIENT = new Dropbox.Client({
    "key": nconf.get('key'),
    "secret": nconf.get('secret'),
    "token": nconf.get('token'),
    "tokenSecret": nconf.get('tokenSecret'),
    "sandbox": true
  })

  CLIENT.authenticate(done)
}

dp.client.createFixEntry = function (client, absdir) {
  return function (entry, nextEntry) {
    var stat = entry.stat
    var fullpath = path.join(absdir, entry.path)

    if (stat === null) {
      // delete the file/folder
      fullpath = path.join(absdir, entry.path)
      remove(fullpath, function (err) {
        if (err && err.code === 'ENOENT')
          return nextEntry()
        else
          return nextEntry(err)
      })
    }
    else {
      console.log('syncing', fullpath)

      if (stat.isFolder) {
        mkdirp(fullpath, nextEntry)
      }
      else {
        var d = path.dirname(fullpath)
        var f = path.basename(fullpath)

        mkdirp(d, function (err) {
          if (err) return nextEntry(err)

          client.readFile(entry.path, { buffer: true }, function (err, data) {
            if (err) return nextEntry(err)

            fs.writeFile(fullpath, data, function (err) {
              nextEntry(err)
            })
          })
        })
      }
    }
  }
}

module.exports = dp
