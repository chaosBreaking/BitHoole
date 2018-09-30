'use strict'
const eth = require('etherscan-api').init('E3ZFFAEMNN33KX4HHVUZ4KF8XY1FXMR4BI');
const secretStorage = require('./utils/secret-storage');
const SigningKey = require('./utils/signing-key.js');
const ticCommon = require('tic.common').Crypto;
const HDNode = require('./utils/hdnode');
const utils = require('./util.js');
const axios = require('axios');

require('setimmediate');

const GAS_UNIT_WEI = 1e18;  //1wei
const GAS_UNIT_GWEI = 1e9;  //1gwei = 1e9 wei
const GAS_Fee = 0.000021;
const GAS_Fee_ERC20 = 0.000060;
const GAS_LIMIT = 21000;
const GAS_LIMIT_ERC20 = 60000;
const defaultPath = "m/44'/60'/0'/0/0";
const ETH_NODE = require('./netConfig').ETH_NODE;

const transactionFields = [
    {name: 'nonce',    maxLength: 32, },
    {name: 'gasPrice', maxLength: 32, },
    {name: 'gasLimit', maxLength: 32, },
    {name: 'to',          length: 20, },
    {name: 'value',    maxLength: 32, },
    {name: 'data'},
];

class ETH {
    constructor(privateKey){
        if(privateKey.length == 64 && !(privateKey.split('x')[1] && privateKey.split('x')[0] === '0'))
            privateKey = '0x'+privateKey;
        var signingKey = privateKey;
        if (!(privateKey instanceof SigningKey)) {
            signingKey = new SigningKey(privateKey);
        }
        Object.defineProperties(this, {
            'privateKey' : {
                enumerable : true,
                writable : false,
                value : signingKey.privateKey
            },
            'address' : {
                enumerable : true,
                writable : false,
                value : signingKey.address,
            },
            'url' : {
                enumerable: true,
                get: function() { return this._url; },
                set: function(url) {
                    if (typeof(url) !== 'string') { throw new Error('invalid url'); }
                    this._url = url;
                },
            },      
            'defaultGasFee' : { 
                enumerable: true,
                get: function() { return this._defaultGasFee; },
                set: function(value) {
                    if (typeof(value) !== 'number') { throw new Error('invalid defaultGasFee'); }
                    this._defaultGasFee = value;
                }
            }
        })
        this._defaultGasFee = GAS_Fee;
        this._url = ETH_NODE;
    }
    static generateNewAccount(option = {path:defaultPath}){
        //major path as default path >/0'/0/0
        var mnemonic =  ticCommon.randomSecword();
        return Object.assign(ETH.fromMnemonic(mnemonic, option),{mnemonic,mnemonic})
    }
    static fromMnemonic(mnemonic, option = {path:defaultPath}){
        HDNode.isValidMnemonic(mnemonic)    //check valid mnemonic,will throw Error if not valid
        let seed = HDNode.mnemonicToSeed(mnemonic)
        return new ETH(HDNode.fromSeed(seed).derivePath(option.path).privateKey)
    }
    static async getBalance(address){
        if(!address){ throw new Error('Address is required'); }
        let res = (await axios.post(ETH_NODE,{
            "jsonrpc":"2.0","method":"eth_getBalance","params":[address, "latest"],"id":1
        })).data
        if(res)
        return parseInt(res.result)/1e18    //1000000000000000000
        else return null
    }
    static async getActions(address){
        let tx = await eth.account.txlist(address, 0 ,'latast')
        if(tx && tx.message === "OK")
            return tx.result
        else return [] 
    }
    static fromEncryptedWallet(json, password, progressCallback) {
        if (progressCallback && typeof(progressCallback) !== 'function') {
            throw new Error('invalid callback');
        }
    
        return new Promise(function(resolve, reject) {
    
            if (secretStorage.isCrowdsaleWallet(json)) {
                try {
                    var privateKey = secretStorage.decryptCrowdsale(json, password);
                    resolve(new ETH(privateKey));
                } catch (error) {
                    reject(error);
                }
    
            } else if (secretStorage.isValidWallet(json)) {
    
                secretStorage.decrypt(json, password, progressCallback).then(function(signingKey) {
                    var wallet = new ETH(signingKey);
                    if (signingKey.mnemonic && signingKey.path) {
                        utils.defineProperty(wallet, 'mnemonic', signingKey.mnemonic);
                        utils.defineProperty(wallet, 'path', signingKey.path);
                    }
                    resolve(wallet);
                    return null;
                }, function(error) {
                    reject(error);
                }).catch(function(error) { reject(error); });
    
            } else {
                reject('invalid wallet JSON');
            }
        });
    }
    static parseTransaction(rawTransaction){
        rawTransaction = utils.hexlify(rawTransaction, 'rawTransaction');
        var signedTransaction = utils.RLP.decode(rawTransaction);
        if (signedTransaction.length !== 9) { throw new Error('invalid transaction'); }
    
        var raw = [];
    
        var transaction = {};
        transactionFields.forEach(function(fieldInfo, index) {
            transaction[fieldInfo.name] = signedTransaction[index];
            raw.push(signedTransaction[index]);
        });
    
        if (transaction.to) {
            if (transaction.to == '0x') {
                delete transaction.to;
            } else {
                transaction.to = utils.getAddress(transaction.to);
            }
        }
    
        ['gasPrice', 'gasLimit', 'nonce', 'value'].forEach(function(name) {
            if (!transaction[name]) { return; }
            if (transaction[name].length === 0) {
                transaction[name] = utils.bigNumberify(0);
            } else {
                transaction[name] = utils.bigNumberify(transaction[name]);
            }
        });
    
        if (transaction.nonce) {
            transaction.nonce = transaction.nonce.toNumber();
        } else {
            transaction.nonce = 0;
        }
    
        var v = utils.arrayify(signedTransaction[6]);
        var r = utils.arrayify(signedTransaction[7]);
        var s = utils.arrayify(signedTransaction[8]);
    
        if (v.length >= 1 && r.length >= 1 && r.length <= 32 && s.length >= 1 && s.length <= 32) {
            transaction.v = utils.bigNumberify(v).toNumber();
            transaction.r = signedTransaction[7];
            transaction.s = signedTransaction[8];
    
            var chainId = (transaction.v - 35) / 2;
            if (chainId < 0) { chainId = 0; }
            chainId = parseInt(chainId);
    
            transaction.chainId = chainId;
    
            var recoveryParam = transaction.v - 27;
    
            if (chainId) {
                raw.push(utils.hexlify(chainId));
                raw.push('0x');
                raw.push('0x');
                recoveryParam -= chainId * 2 + 8;
            }
    
            var digest = utils.keccak256(utils.RLP.encode(raw));
            try {
                transaction.from = SigningKey.recover(digest, r, s, recoveryParam);
            } catch (error) {
                console.log(error);
            }
        }
    
    
        return transaction;
    }
    static encrypt(data, key){
        if(!data || !key) throw new Error('Required Params Missing')
        return ticCommon.encrypt(data,key)
    }
    static decrypt(data, key){
        return ticCommon.decrypt(data, key, {format:"json"})  //return null for wrong key
    }
    static async estimateGasPrice(){
        try{
            return parseInt((await axios.post(ETH_NODE, {
                "method": "eth_gasPrice",
                "id": "6842",
                "jsonrpc": "2.0"
            })).data.result)/1e9
        }
        catch(err){
            return 1
        }
    }

    static isValidAddress(address){
        let res = address.match(/^(0x)?[0-9a-fA-F]{40}$/)
        return res && res[0].slice(0,2) === '0x'
    }

    async getBalance(){
        return ETH.getBalance(this.address)
    }
    async getActions(){
        return ETH.getActions(this.address)
    }
    async getTransactionCount(){
        if(!this._url){ throw new Error('Base url required'); }
        var self = this;
        return (await axios.post(this._url,{
            "jsonrpc":"2.0","method":"eth_getTransactionCount","params":[self.address, "latest"],"id":1
        })).data.result||null
    }
    signTransaction(transaction){
        var chainId = transaction.chainId;
        if (chainId == null && this.provider) { chainId = this.provider.chainId; }
        if (!chainId) { chainId = 0; }

        var raw = [];
        transactionFields.forEach(function(fieldInfo) {
            var value = transaction[fieldInfo.name] || ([]);
            value = utils.arrayify(utils.hexlify(value), fieldInfo.name);

            // Fixed-width field
            if (fieldInfo.length && value.length !== fieldInfo.length && value.length > 0) {
                var error = new Error('invalid ' + fieldInfo.name);
                error.reason = 'wrong length';
                error.value = value;
                throw error;
            }

            // Variable-width (with a maximum)
            if (fieldInfo.maxLength) {
                value = utils.stripZeros(value);
                if (value.length > fieldInfo.maxLength) {
                    var error = new Error('invalid ' + fieldInfo.name);
                    error.reason = 'too long';
                    error.value = value;
                    throw error;
                }
            }

            raw.push(utils.hexlify(value));
        });

        if (chainId) {
            raw.push(utils.hexlify(chainId));
            raw.push('0x');
            raw.push('0x');
        }

        var digest = utils.keccak256(utils.RLP.encode(raw));
        var signingKey = new SigningKey(this.privateKey);
        var signature = signingKey.signDigest(digest);

        var v = 27 + signature.recoveryParam
        if (chainId) {
            raw.pop();
            raw.pop();
            raw.pop();
            v += chainId * 2 + 8;
        }

        raw.push(utils.hexlify(v));
        raw.push(utils.stripZeros(utils.arrayify(signature.r)));
        raw.push(utils.stripZeros(utils.arrayify(signature.s)));

        return utils.RLP.encode(raw);
    }
    async sendTransaction(toAddress, amount, option = {gasFee : GAS_Fee}){
        /****************************************************************   
            1 Ether = 1e18 wei  
            1Gwei = 1e9 wei   
            *GWei as the unit of gasPrice, minimum gasPrice is 1Gwei
            *unit of amount is ether，should be translate to wei
        ****************************************************************/
        let nonce = await this.getTransactionCount();
        if(!nonce) nonce = '0x0'
        var gasPrice, gasLimit;
        if(!option.gasPrice || !option.gasLimit){
            //Normal Mode:use customized gasFee( ether ) to caculate gasPrice( wei ), gasLimit use default value
            gasLimit = GAS_LIMIT;
            gasPrice = String(option.gasFee * GAS_UNIT_WEI / gasLimit);
        }
        else{
            //Advance Mode:specified the gasLimit and gasPrice( gwei )
            gasLimit = option.gasLimit;
            gasPrice = String(GAS_UNIT_GWEI * option.gasPrice)
        }
        let transaction = {
            nonce: nonce,
            gasLimit: gasLimit,
            gasPrice: utils.bigNumberify(gasPrice),
            to: toAddress,

            value: utils.parseEther(String(amount)),
        };
        try{
            let signedTransaction = this.signTransaction(transaction);
            let ethTxRes = (await axios.post(ETH_NODE,{
                "jsonrpc":"2.0",
                "method":"eth_sendRawTransaction",
                "params":[signedTransaction.toString('hex')],
                "id":6842
            })).data
            if(ethTxRes && ethTxRes.result)
                return ethTxRes
            return null
        }
        catch(err){
            return null
        }
    }
    encrypt(key){
        return ETH.encrypt(this, key)
    }
}

class ERC20 extends ETH{
    constructor(privateKey, contractAddress){
        if(!contractAddress) throw new Error('Missing contractAddress')
        super(privateKey);
        Object.defineProperty(this, 'contractAddress',{
            enumerable:true,
            writable:false,
            value:contractAddress
        })
    }
    static async getDecimals(contractAddress){
        if(!contractAddress) throw new Error('Missing params')
        let queryAddress = '0x313ce567' + (contractAddress.split('x')[1]).padStart(64,'0')
        let params = [{"to":contractAddress, "data":queryAddress},"latest"]
        let queryData = {
            "jsonrpc":"2.0",
            "method":"eth_call",
            "params":params,
            "id":6842
        }
        return parseInt((await axios.post(ETH_NODE, queryData)).data.result)
    }
    static async getBalance(address, contractAddress){
        if(!address || !contractAddress) throw new Error('Missing params')
        let queryAddress = '0x70a08231' + (address.split('x')[1]).padStart(64,'0')
        let params = [{"to":contractAddress, "data":queryAddress},"latest"]
        let queryData = {
            "jsonrpc":"2.0",
            "method":"eth_call",
            "params":params,
            "id":6842
        }
        // return parseInt(erc20res.result)/Number('10'.padEnd(ERC20Table[obj.name].decimals+1,'0')) 
        let res = (await axios.post(ETH_NODE, queryData)).data.result
        if(res == '0x') return 0
        return parseInt(res)
    }
    static async getActions(address, contractAddress){
        try{   
            let res = (await eth.account.tokentx(address,contractAddress))
            if(res && res.result)
                return res.result
        }
        catch(err){
            return []
        }
        return 
    }

    async getBalance(){
        return ERC20.getBalance(this.address, this.contractAddress)
    }
    async getActions(){
        return ERC20.getActions(this.address, this.contractAddress)
    }  
    async getDecimals(){
        let decimals = await ERC20.getDecimals(this.contractAddress)
        if(decimals)
            Object.defineProperty(this, 'decimals', {
                enumerable:true,
                value:decimals,
                writable:false
            })
        else
            return 0    // any good idea?
    }
    async sendTransaction(toAddress, amount, option = {gasFee : GAS_Fee_ERC20}){
        /****************************************************************   
            1 Ether = 1e18 wei  
            1 Gwei = 1e9 wei   
            *GWei as the unit of gasPrice, minimum gasPrice is 1Gwei
            minimum gaslimit for erc20transaction is 60000
        ****************************************************************/
        var nonce = await this.getTransactionCount();
        var gasPrice, gasLimit, decimals, contractAddress = this.contractAddress;
        if(!nonce) nonce = '0x0'
        if(!option.gasPrice || !option.gasLimit){
            //Normal Mode:use customized gasFee( ether ) to caculate gasPrice( wei ), gasLimit use default value
            gasLimit = GAS_LIMIT_ERC20;
            gasPrice = String(option.gasFee * GAS_UNIT_WEI / gasLimit);
        }
        else{
            //Advance Mode:specified the gasLimit and gasPrice( gwei )
            gasLimit = option.gasLimit;
            gasPrice = String(GAS_UNIT_GWEI * option.gasPrice)
        }
        if(!option.decimals) decimals = await ERC20.getDecimals(contractAddress)
        let txBody = '0x' + 'a9059cbb' + toAddress.split('x')[1].padStart(64,'0')+ Number(amount*Math.pow(10,decimals)).toString(16).padStart(64,'0')
        let transaction = {
            nonce: nonce,
            gasLimit: gasLimit,
            gasPrice : utils.bigNumberify(gasPrice),
            to: contractAddress,
            value : 0,
            data : txBody
        };
        let signedTransaction = this.signTransaction(transaction);
        try{
            let erc20TxRes = (await axios.post(ETH_NODE, {
                "jsonrpc":"2.0",
                "method":"eth_sendRawTransaction",
                "params":[signedTransaction.toString('hex')],
                "id":6842
            })).data
            if(erc20TxRes && erc20TxRes.result)
                return erc20TxRes.result
            console.log(erc20TxRes)
            return null
        }
        catch(err){
            return null
        }
    }

}

module.exports = {
    ETH, ERC20
}

