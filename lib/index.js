var readline = require('readline')
var Dropbox = require('dropbox')

var dp = module.exports = function (opts) {
  this.key                = opts.key
  this.secret             = opts.secret
  this.oauth_token        = opts.oauth_token
  this.oauth_token_secret = opts.oauth_token_secret
}

dp.prototype.authenticate = function () {

}
