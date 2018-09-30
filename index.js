'use strict'

const TIC = require('./tic.js').TIC;
const ETH = require('./eth.js').ETH;
const ERC20 = require('./eth.js').ERC20;
const BTC = require('./btc.js').BTC;
const Account = require('./Account').Account;
const Crypto = require('tic.common').Crypto;
module.exports = {
    TIC,
    ETH,
    BTC,
    ERC20,
    Account,
    Crypto,
}