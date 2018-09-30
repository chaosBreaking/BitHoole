'use strict'

const axios = require('axios');
const HDNode = require('./utils/hdnode');
const bitcoinjs = require('bitcoinjs-lib');
// const bitcore = require('tic.common').Bitcore;
const ticCommon = require('tic.common').Crypto;
const BTC_NODE = require('./netConfig').BTC_NODE;
const BTC_NODE2 = require('./netConfig').BTC_NODE2;
const BTC_TXFEE = 30;

class BTC {
    constructor(privateKey){
        if(!ticCommon.isSeckey(privateKey)) throw new Error('Invalid PrivateKey')
        var publicKey = ticCommon.seckey2pubkey(privateKey)
        Object.defineProperties(this,{
            "privateKey" : {
                enumerable : true,
                writable : false,
                value : privateKey
            },
            "publicKey": {
                enumerable : true,
                writable : false,
                value : ticCommon.seckey2pubkey(privateKey,{coin:"BTC"})
            },
            "address" : {
                enumerable : true,
                writable : false,
                value : ticCommon.pubkey2address(publicKey,{coin:"BTC"}) 
            },
            "url" : {
                enumerable : true,
                get: function() { return this._url; },
                set: function(url) {
                    if (typeof(url) !== 'string') { throw new Error('invalid url'); }
                    this._url = url;
                }
            },
            "defaultGas":{
                enumerable: true,
                get: function() { return this._defaultGasFee; },
                set: function(value) {
                    if (typeof(value) !== 'number') { throw new Error('invalid defaultGasFee'); }
                    this._defaultGasFee = value;
                }
            }
        })
        this._url = BTC_NODE;
        this._defaultGasFee = BTC_TXFEE;

    }
    static generateNewAccount(){
        var mnemonic = ticCommon.randomSecword()
        return Object.assign(new BTC(ticCommon.secword2keypair(mnemonic, {coin:"BTC"}).seckey),{mnemonic : mnemonic})
    }
    static fromMnemonic(mnemonic){
        HDNode.isValidMnemonic(mnemonic)
        return Object.assign(new BTC(ticCommon.secword2keypair(mnemonic, {coin:"BTC"}).seckey),{mnemonic:mnemonic})
    }
    static async getBalance(address){
        return (await axios.get(`${BTC_NODE}/addrs/${address}/balance`)).data.balance
    }
    static async getActions(address){
        return (await axios.get(`${BTC_NODE}/addrs/${address}`)).data.txrefs
    }
    static async getUTXO(address){
        // console.log(`${BTC_NODE2}/unspent?active=${address}`,`${BTC_NODE2}/unspent?active=${address}`)
        try {
            return (await axios.get(`${BTC_NODE2}/unspent?active=${address}`)).data.unspent_outputs
        } catch (error) {
            return null
        }
    }
    static encrypt(data, key){
        if(!data || !key) throw new Error('Required Params Missing')
        return ticCommon.encrypt(data,key)
    }
    static decrypt(data, key){
        return ticCommon.decrypt(data, key, {format:"json"})  //return null for wrong key
    }
    static isValidAddress(address){
        return address.length == 34 && address[0] == '1'
    }
    async sendTransaction(toAddress, amount, option = {gasFee : BTC_TXFEE}){
        let set = bitcoinjs.ECPair.fromPrivateKey(Buffer.from(this.privateKey,'hex'));//导入私钥用于签名
        let txb = new bitcoinjs.TransactionBuilder();//初始化交易对象
        let tx = await BTC.getUTXO('1DEP8i3QJCsomS4BSMY2RpU1upv62aGvhD')
        if(!tx) return null
        var tot = 0;//用于记录UTXO总量
        amount+=1e4;//消费金额是转出金额加上10000的矿工费
        txb.setVersion(1);//设置交易版本号
        for(var i=0;i<tx.length;i++){   //将UTXO的相关信息依次填入交易体中
            txb.addInput(tx[i].tx_hash_big_endian, tx[i].tx_output_n);
            tot+=tx[i].value;
        }
        
        txb.addOutput(toAddress, amount-1e4);//填入转出目标地址和对应的金额
        txb.addOutput(this.address, tot-amount); //填入找零地址，也就是原地址，并填入把找零金额
        for(var i=0;i<tx.length;i++){//对交易体中的UTXO依次签名
            txb.sign(i, set);
        }
        // let txBody = txb.buildIncomplete().toHex()
        let data = {tx : txb.buildIncomplete().toHex()}
        try {
            let res = await axios.post(`${BTC_NODE}/txs/push`,data)
            return res
        } catch (error) {
            return null
        }

    }
    // async sendTransaction(toAddress, amount, option = {gasFee : BTC_TXFEE}){
    //     var privateKey = bitcore.PrivateKey(this.privateKey)
    //     var ecdsa = new bitcore.crypto.ECDSA();

    //     var newtx = {
    //         inputs: [{addresses: [this.address]}],
    //         outputs: [{addresses: [toAddress], value: amount}]
    //     };
    //     try {
    //         var tmptx = (await axios.post('https://api.blockcypher.com/v1/btc/test3/txs/new',newtx)).data;
    //         tmptx.pubkeys = [];
    //         tmptx.pubkeys.push(privateKey.toPublicKey().toString("hex"))
    //         ecdsa.hashbuf = bitcore.crypto.Hash.sha256(new Buffer(tmptx.tosign));
    //         ecdsa.privkey = privateKey;
    //         ecdsa.pubkey = privateKey.toPublicKey();
    //         ecdsa.deterministicK();
    //         let signatureExpected = ecdsa.sign();
    //         tmptx.signatures = [Buffer.from(signatureExpected.sig.toDER()).toString('hex')]
    //         let res = (await axios.post('https://api.blockcypher.com/v1/btc/test3/txs/send',tmptx)).data
    //         return res
    //     } catch (error) {
    //         return error.response.data
    //     }
    // }       

    async getBalance(){
        return await BTC.getBalance(this.address)
    }
    async getActions(){
        return await BTC.getActions(this.address)
    }
    encrypt(key){
        return BTC.encrypt(this,key)
    }
}

module.exports = {
    BTC
}