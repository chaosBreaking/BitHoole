'use strict'
const axios = require('axios')
const ticCommon = require('tic.common').Crypto
const ticActTransfer = require('tic.common').ActTransfer

const TIC_TXFEE = 10;
const TIC_NODE = require('./netConfig').TIC_NODE

class TIC {
    constructor(seckey,option={}){
        if(!seckey||!ticCommon.isSeckey(seckey)) throw "ERROR:Invalid Seckey"
        Object.defineProperties(this, {
            'seckey' : {
                value : seckey,
                enumerable : true,
                writable : false,
            },
            'pubkey' : {
                value : ticCommon.seckey2pubkey(seckey), 
                enumerable : true,
                writable : false,
            },
            'address' : {
                value : ticCommon.pubkey2address(ticCommon.seckey2pubkey(seckey)),
                enumerable : true,
                writable : false
            }
        })
        Object.assign(this,{
            _url : option._url||TIC_NODE,
            _defaultFee : option.fee||TIC_TXFEE  //fee cannot be zero
        })
    }
    get url(){return this._url}
    set url(newURL){this._url = newURL}
    get txfee(){return this._defaultFee}
    set txfee(fee){this._defaultFee = fee}

    static generateNewAccount(){
        var secword = ticCommon.randomSecword()
        return Object.assign(new TIC(ticCommon.secword2keypair(secword).seckey),{secword:secword})
    }
    static fromMnemonic(secword){
        if(!secword||!ticCommon.isSecword(secword)) throw "ERROR:Invalid Secword"
        return new TIC(ticCommon.secword2keypair(secword).seckey)
    }
    static async getBalance(address){
        if(!address){ throw new Error('Address is required'); }
        return (await axios.post(TIC_NODE+'/Account/getBalance',{
            "Account" : {
                "address":address
            }
        })).data
    }
    static async getActions(address){
        if(!address){ throw new Error('Address is required'); }
        return (await axios.post(TIC_NODE+'/Action/getActionList',{
            "Action" : {
                "actorAddress" : address,
                "toAddress" : address
            },
            "config":{
                "logic":"OR"
            }
        })).data 
    }
    static encrypt(data, key){
        if(!data || !key) throw new Error('Required Params Missing')
        return ticCommon.encrypt(data,key)
    }
    static decrypt(data, key){
        return ticCommon.decrypt(data, key, {format:"json"})  //return null for wrong key
    }

    static isValidAddress(address){
        return ticCommon.isAddress(address)
    }

    async sendTransaction(toAddress, amount, option = {gasFee : TIC_TXFEE}){
        if(!toAddress||!amount){throw new Error("ERROR:RequiredParamsMissing")}  //amount cannot be zero
        let action = new ticActTransfer({
            amount: parseInt(amount), 
            toAddress: toAddress,
            fee: option.gasFee
        })
        //对交易数据签名,packMe 内的参数是交易发起人的keypair
        action.packMe({
            seckey: this.seckey,
            pubkey: this.pubkey,
            address: this.address
        })
        let data = {
            Action:action
        }
        try{

            let res = (await axios.post(this._url + '/Action/prepare',data)).data
            return res
        }catch(err){
            return null
        }
    }  
    async getBalance(){
        return TIC.getBalance(this.address)
    }
    async getActions(){
        return TIC.getActions(this.address)
    }
    getSerializedTx(option){
        if(!option.toAddress||!option.amount){throw new Error("ERROR:RequiredParamsMissing")}
        let action=new ticActTransfer({
            amount: parseInt(option.amount), 
            toAddress: option.toAddress,
            fee:option.fee||this._defaultFee
        })
        //sign for txBody use function packMe, which needs actor's keypair as parameter
        action.packMe({
        seckey: this.seckey,
        pubkey: this.pubkey,
        address: this.address
        })
        return action
    }
    //default key for sign&encrypt is account's seckey,other keys are optional.
    sign(message,key = this.seckey){
        return ticCommon.sign(message,key)
    }
    verify(message,signature){
        return ticCommon.sign(message,signature,this.seckey)
    }
    encrypt(key){
        return TIC.encrypt(this, key)
    }
    
}
module.exports = {TIC}
