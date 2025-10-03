// Test to find what pubkey gives us this hash
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

// Use the mnemonic from the server
const mnemonic = "rack spare detail debris stay blossom winner try urban inmate diagram neutral scrub wheat humor husband shift hammer wet nasty close oil firm erosion";
const seed = bip39.mnemonicToSeedSync(mnemonic);
const network = bitcoin.networks.regtest;

const root = bip32Instance.fromSeed(seed, network);

// Try different coin types
for (let coinType of [0, 1]) {
  console.log(`\nTrying coinType ${coinType}:`);
  const lockupAccount = root.derivePath(`m/84'/${coinType}'/0'`);
  const lockupNode = lockupAccount.derive(0).derive(0);
  const pubkey = lockupNode.publicKey;
  const pubkeyHash = hash160(pubkey);
  
  console.log('  Pubkey:', pubkey.toString('hex'));
  console.log('  Pubkey hash:', pubkeyHash.toString('hex'));
  
  if (pubkeyHash.toString('hex') === 'b472a266d0bd89c13706a4132ccfb16f7c3b9fcb') {
    console.log('  *** MATCH! This is the wrong one in the redeem script');
  }
  if (pubkeyHash.toString('hex') === '02fbefe56a3187f1cc12eac2d007790693fe8ad6') {
    console.log('  *** MATCH! This is the correct one');
  }
}
