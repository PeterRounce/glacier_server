// Verify the timelock creation process
const bip39 = require('bip39');
const bip32 = require('bip32');
const bitcoin = require('bitcoinjs-lib');
const ecc = require('tiny-secp256k1');
const crypto = require('crypto');

const BIP32Factory = bip32.default || bip32.BIP32Factory;
const bip32Instance = BIP32Factory(ecc);

function hash160(data) {
  const sha = crypto.createHash('sha256').update(data).digest();
  const ripe = crypto.createHash('ripemd160').update(sha).digest();
  return ripe;
}

// Use the current wallet's mnemonic
const mnemonic = "bleak engine drastic super tennis wait under capable dawn crumble clarify marine situate smile obvious liar cushion cost gather burden tortoise funny dish tissue";
const seed = bip39.mnemonicToSeedSync(mnemonic);
const network = bitcoin.networks.regtest;

const root = bip32Instance.fromSeed(seed, network);

// For regtest: coinType should be 1
const coinType = 1;
const lockupAccount = root.derivePath(`m/84'/${coinType}'/0'`);

// Derive lockup address at index 0
const lockupNode = lockupAccount.derive(0).derive(0);
const pubkey = lockupNode.publicKey;
const pubkeyHash = hash160(pubkey);

console.log('Expected lockup pubkey:', pubkey.toString('hex'));
console.log('Expected pubkey hash:', pubkeyHash.toString('hex'));

const payment = bitcoin.payments.p2wpkh({
  pubkey: pubkey,
  network: network
});

console.log('Expected lockup address:', payment.address);
console.log('\nFrom API:');
console.log('Actual lockup address:', 'bcrt1qnnu9h4h6594c2wwa2qpcvuhhvfn25fwrzyp744');
console.log('Redeem script pubkey hash:', 'b472a266d0bd89c13706a4132ccfb16f7c3b9fcb');
