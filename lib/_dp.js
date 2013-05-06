var fs = require('fs')
var path = require('path')
var readline = require('readline')

var async = require('async')
var Dropbox = require('dropbox')
var mkdirp = require('mkdirp')
var nconf = require('nconf')
var remove = require('remove')

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
          // get app key, secret
          var prompt = readline.createInterface({ input: process.stdin, output: process.stdout })

          prompt.question('app key: ', function (key) {
            prompt.question('app secret: ', function (secret) {
              nconf.set('key', key)
              nconf.set('secret', secret)

              prompt.close()
              next(null)
            })
          })
        },
        function (next) {
          var client = new Dropbox.Client({
            "key": nconf.get('key'),
            "secret": nconf.get('secret'),
            "sandbox": true
          })

          client.authDriver({
            url: function() { return ""; },
            doAuthorize: function (authUrl, token, tokenSecret, done) {
              var prompt = readline.createInterface({ input: process.stdin, output: process.stdout })

              prompt.question("visit the following in a browser, then press enter:\n  " + authUrl + "\n", function (okay) {
                prompt.close()
                done()
              })
            }
          })

          client.authenticate(function (err, client) {
            nconf.set('token', client.oauth.token)
            nconf.set('tokenSecret', client.oauth.tokenSecret)
            next(err)
          })
        },
        function (next) {
          // make directory, create config file
          mkdirp(dir, function (err) {
            if (err) return next(err)

            nconf.save(function (err) {
              if (err) return next(err)

              console.log('initialized directory in', dir)
            })
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

    // nconf.set('cursor', changes.cursor())

    var diff = changes.changes;

    async.series([
      function (next) {
        // clear directory if need be, then rewrite (old) config file
        if (changes.blankSlate) {
          remove(dir, function (err) {
            mkdirp(dir, function (err) {
              if (err) return next(err)
              nconf.save(next)
            })
          })
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
        var doStuff = function (item, plusplus) {
          var stat = item.stat;
          var d = '';
          var f = '';
          var fullpath = '';
          if (stat === null) {
            // delete the file/folder
            fullpath = path.join(dir, item.path)
            remove(fullpath, function (err) {
              if (err) {
                if (err.code === 'ENOENT') {
                  return plusplus()
                }
                else {
                  return plusplus(err)
                }
              }
              return plusplus()
            })
          }
          else {
            if (stat.isFolder) {
              d = item.path
            }
            else {
              d = path.dirname(item.path)
              f = path.basename(item.path)
            }
            d = path.join(dir, d)
            fullpath = path.join(d, f)

            console.log('syncing', fullpath)

            mkdirp(d, function (err) {
              if (err) return plusplus(err)

              if (stat.isFile) {
                client.readFile(item.path, { buffer: true }, function (err, data) {
                  if (err) return plusplus(err)

                  fs.writeFile(fullpath, data, function (err) {
                    plusplus(err)
                  })
                })
              }
              else {
                plusplus()
              }
            })
          }
        }

        async.eachSeries(diff, doStuff, function (err) {
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