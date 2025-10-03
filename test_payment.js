const bitcoin = require('bitcoinjs-lib');
const crypto = require('crypto');

function hash160(data) {
  const sha = crypto.createHash('sha256').update(data).digest();
  const ripe = crypto.createHash('ripemd160').update(sha).digest();
  return ripe;
}

const pubkey = Buffer.from('034c98fb2f2be69f66f6e794877d2e502c29b98c6fd864a0ed663777ccb8baf690', 'hex');
const pubkeyHash = hash160(pubkey);
console.log('Manual hash160:', pubkeyHash.toString('hex'));

const payment = bitcoin.payments.p2wpkh({
  pubkey: pubkey,
  network: bitcoin.networks.regtest
});

console.log('P2WPKH address:', payment.address);
console.log('P2WPKH hash (from payment.hash):', payment.hash.toString('hex'));
