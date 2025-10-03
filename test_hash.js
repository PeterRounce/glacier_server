const crypto = require('crypto');

function hash160(data) {
  const sha = crypto.createHash('sha256').update(data).digest();
  const ripe = crypto.createHash('ripemd160').update(sha).digest();
  return ripe;
}

// From the transaction - the pubkey used in the scriptSig
const pubkey = Buffer.from('0225104de1f5239d9ec0cfb9a7d0ffa9c35f717420a4dfa9ab60680e883642897d', 'hex');
const hash = hash160(pubkey);
console.log('Pubkey hash from transaction:', hash.toString('hex'));

// From the redeem script
console.log('Pubkey hash in redeem script:', 'b472a266d0bd89c13706a4132ccfb16f7c3b9fcb');

// Expected from bcrt1qqta7let2xxrlrnqjatpdqpmeq6flazkk3lkdwn
console.log('Expected from address:', '02fbefe56a3187f1cc12eac2d007790693fe8ad6');
