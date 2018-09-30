'use strict'
module.exports = (function() {
    var convert = require('./utils/convert');
    var hmac = require('./utils/hmac');
    var base64 = require('./utils/base64');
    return {
        defineProperty: require('./utils/properties').defineProperty,

        arrayify: convert.arrayify,
        hexlify: convert.hexlify,
        stripZeros: convert.stripZeros,
        concat: convert.concat,
        padZeros: convert.padZeros,
        stripZeros: convert.stripZeros,
        base64: base64,        

        bigNumberify: require('./utils/bignumber').bigNumberify,

        toUtf8Bytes: require('./utils/utf8').toUtf8Bytes,

        getAddress: require('./utils/address').getAddress,

        keccak256: require('./utils/keccak256'),

        RLP: require('./utils/rlp'),

        pbkdf2: require('./utils/pbkdf2.js'),

        createSha512Hmac: hmac.createSha512Hmac,

        // isMnemonic: isMnemonic,

        parseEther:require('./utils/units').parseEther
    };
})();
