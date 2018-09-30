'use strict'
const Coins = {}
Coins.TIC = require('./tic.js').TIC;
Coins.ETH = require('./eth.js').ETH;
Coins.ERC20 = require('./eth.js').ERC20;
Coins.BTC = require('./btc.js').BTC;

class Account {
    constructor(coinType,privateKey,contractAddress){
        if(coinType === 'tic' || coinType === 'btc' || coinType === 'eth')
            return new Coins[coinType.toUpperCase()](privateKey)
        else
            return new Coins.ERC20(privateKey,contractAddress)
    }
    static generateNewAccount(coinType){
        if(coinType === 'tic' || coinType === 'btc') 
            return Coins[coinType.toUpperCase()].generateNewAccount()
        return Coins.ETH.generateNewAccount()
    }
    static fromMnemonic(coinType,mnemonic){
        if(coinType === 'tic' || coinType === 'btc' || coinType === 'eth')
            return Coins[coinType.toUpperCase()].fromMnemonic(mnemonic)   
        return Coins.ETH.fromMnemonic(mnemonic)
    }
    static fromPrivateKey(coinType,privateKey,contractAddress){
        if(coinType === 'tic' || coinType === 'btc' || coinType === 'eth')
            return new Coins[coinType.toUpperCase()](privateKey)
        return new Coins.ERC20(privateKey,contractAddress)        
    }
    static async fromOfficalWallet(encryptedWallet,key){
        return await Coins.ETH.fromEncryptedWallet(encryptedWallet,key)
    }
    static async getBalance(coinType,address,contractAddress){
        if(coinType === 'tic' || coinType === 'btc' || coinType === 'eth')
            return await Coins[coinType.toUpperCase()].getBalance(address)
        return await Coins.ERC20.getBalance(address,contractAddress)  
    }
    static async getActions(coinType,address,contractAddress){
        if(coinType === 'tic' || coinType === 'btc' || coinType === 'eth')
            return await Coins[coinType.toUpperCase()].getActions(address)
        return await Coins.ERC20.getActions(address,contractAddress)          
    }
    static decrypt(coinType,encryptedWallet,key){
        if(coinType === 'tic' || coinType === 'btc' || coinType === 'eth')
            return Coins[coinType.toUpperCase()].decrypt(encryptedWallet,key)
        return Coins.ETH.decrypt(encryptedWallet,key)        
    }
    static isValidAddress(coinType, address){
        if(!coinType || !address) return null
        switch(coinType){
            case "tic": return Coins.TIC.isValidAddress(address)
            case "btc": return Coins.BTC.isValidAddress(address)
            default: return Coins.ETH.isValidAddress(address)
        }
    }
}

module.exports = {
    Account
}