// Test script to debug timelock creation
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
const lockupAccount = root.derivePath("m/84'/1'/0'"); // regtest uses coinType 1

// Derive lockup address at index 0
const lockupNode = lockupAccount.derive(0).derive(0);
const pubkey = lockupNode.publicKey;
const pubkeyHash = hash160(pubkey);

console.log('Lockup node pubkey:', pubkey.toString('hex'));
console.log('Lockup node pubkey hash:', pubkeyHash.toString('hex'));

const payment = bitcoin.payments.p2wpkh({
  pubkey: pubkey,
  network: network
});

console.log('Lockup address:', payment.address);
