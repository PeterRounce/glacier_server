// The pubkey from debug output (decimal array)
const pubkeyDecimal = [3,78,152,251,47,43,230,159,102,246,231,148,135,125,46,80,44,41,185,140,111,216,100,160,237,102,55,119,204,184,186,246,144];
const pubkey = Buffer.from(pubkeyDecimal);
console.log('Pubkey hex:', pubkey.toString('hex'));

const crypto = require('crypto');
function hash160(data) {
  const sha = crypto.createHash('sha256').update(data).digest();
  const ripe = crypto.createHash('ripemd160').update(sha).digest();
  return ripe;
}

const pubkeyHash = hash160(pubkey);
console.log('Pubkey hash:', pubkeyHash.toString('hex'));

const bitcoin = require('bitcoinjs-lib');
const payment = bitcoin.payments.p2wpkh({
  pubkey: pubkey,
  network: bitcoin.networks.regtest
});

console.log('Address:', payment.address);
console.log('Payment hash:', payment.hash.toString('hex'));
