/**
 * Bitcoin CLI Proxy Server
 * Provides REST API endpoints that call bitcoin-cli
 */

const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const util = require('util');

const execPromise = util.promisify(exec);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Default network (can be changed via env var)
const DEFAULT_NETWORK = process.env.BITCOIN_NETWORK || 'regtest';

// Helper function to execute bitcoin-cli commands
async function bitcoinCli(command, network = DEFAULT_NETWORK) {
  try {
    const networkFlag = network === 'mainnet' ? '' : `-${network}`;
    const fullCommand = `bitcoin-cli ${networkFlag} ${command}`;
    console.log(`Executing: ${fullCommand}`);
    
    const { stdout, stderr } = await execPromise(fullCommand);
    
    if (stderr && !stderr.includes('Warning')) {
      console.error('Bitcoin CLI stderr:', stderr);
    }
    
    return stdout.trim();
  } catch (error) {
    console.error('Bitcoin CLI error:', error.message);
    throw error;
  }
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get current block height
app.get('/api/blockheight', async (req, res) => {
  try {
    const network = req.query.network || DEFAULT_NETWORK;
    const result = await bitcoinCli('getblockcount', network);
    const height = parseInt(result);
    
    res.json({ 
      success: true, 
      height,
      network,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get blockchain info
app.get('/api/blockchaininfo', async (req, res) => {
  try {
    const network = req.query.network || DEFAULT_NETWORK;
    const result = await bitcoinCli('getblockchaininfo', network);
    const info = JSON.parse(result);
    
    res.json({ 
      success: true, 
      data: info,
      network
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get transaction details with decoded hex (includes scripts)
// IMPORTANT: This route must come BEFORE /api/transaction/:txid to match correctly
app.get('/api/transaction/:txid/decoded', async (req, res) => {
  try {
    const { txid } = req.params;
    const network = req.query.network || DEFAULT_NETWORK;
    
    // Get transaction with verbose details
    const result = await bitcoinCli(`gettransaction ${txid} true`, network);
    const tx = JSON.parse(result);
    
    // Use getrawtransaction with verbosity 2 to get prevout info
    if (tx.hex) {
      try {
        // Verbosity 2 includes prevout information for inputs
        const rawTxResult = await bitcoinCli(`getrawtransaction ${txid} 2`, network);
        const rawTx = JSON.parse(rawTxResult);
        
        // Use the raw transaction data which includes prevout
        tx.decoded = rawTx;
      } catch (decodeError) {
        console.error('Could not get raw transaction with prevout:', decodeError.message);
        // Fallback to basic decoding
        try {
          const decoded = await bitcoinCli(`decoderawtransaction ${tx.hex}`, network);
          tx.decoded = JSON.parse(decoded);
        } catch (fallbackError) {
          console.error('Could not decode transaction hex:', fallbackError.message);
        }
      }
    }
    
    res.json({ 
      success: true, 
      data: tx,
      network
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get transaction details
app.get('/api/transaction/:txid', async (req, res) => {
  try {
    const { txid } = req.params;
    const network = req.query.network || DEFAULT_NETWORK;
    
    const result = await bitcoinCli(`gettransaction ${txid}`, network);
    const tx = JSON.parse(result);
    
    res.json({ 
      success: true, 
      data: tx,
      network
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get raw transaction (decoded)
app.get('/api/rawtransaction/:txid', async (req, res) => {
  try {
    const { txid } = req.params;
    const network = req.query.network || DEFAULT_NETWORK;
    
    const result = await bitcoinCli(`getrawtransaction ${txid} true`, network);
    const tx = JSON.parse(result);
    
    res.json({ 
      success: true, 
      data: tx,
      network
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// List transactions
app.get('/api/transactions', async (req, res) => {
  try {
    const network = req.query.network || DEFAULT_NETWORK;
    const count = req.query.count || 10;
    
    const result = await bitcoinCli(`listtransactions "*" ${count}`, network);
    const transactions = JSON.parse(result);
    
    res.json({ 
      success: true, 
      data: transactions,
      network
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get unspent outputs for an address
app.get('/api/listunspent', async (req, res) => {
  try {
    const network = req.query.network || DEFAULT_NETWORK;
    const minconf = req.query.minconf || 1;
    const address = req.query.address;
    
    // If address is specified, use scantxoutset instead of listunspent
    // because listunspent only shows wallet UTXOs
    if (address) {
      try {
        const scanCommand = `scantxoutset start '["addr(${address})"]'`;
        const scanResult = await bitcoinCli(scanCommand, network);
        const scanData = JSON.parse(scanResult);
        
        // Format the output to match listunspent structure
        const utxos = scanData.unspents ? scanData.unspents.map(utxo => ({
          txid: utxo.txid,
          vout: utxo.vout,
          address: address,
          scriptPubKey: utxo.scriptPubKey,
          amount: utxo.amount,
          confirmations: utxo.height ? scanData.height - utxo.height + 1 : 0,
          spendable: false,
          solvable: false
        })) : [];
        
        res.json({ 
          success: true, 
          data: utxos,
          network,
          method: 'scantxoutset'
        });
        return;
      } catch (scanError) {
        console.error('scantxoutset failed, falling back to listunspent:', scanError.message);
        // Fall through to listunspent
      }
    }
    
    let command = `listunspent ${minconf}`;
    if (address) {
      command += ` 9999999 '["${address}"]'`;
    }
    
    const result = await bitcoinCli(command, network);
    const utxos = JSON.parse(result);
    
    res.json({ 
      success: true, 
      data: utxos,
      network
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Broadcast transaction
app.post('/api/sendrawtransaction', async (req, res) => {
  try {
    const { hex } = req.body;
    const network = req.query.network || DEFAULT_NETWORK;
    
    if (!hex) {
      return res.status(400).json({ 
        success: false, 
        error: 'Transaction hex is required' 
      });
    }
    
    const result = await bitcoinCli(`sendrawtransaction ${hex}`, network);
    
    res.json({ 
      success: true, 
      txid: result,
      network
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Test transaction (without broadcasting)
app.post('/api/testmempoolaccept', async (req, res) => {
  try {
    const { hex } = req.body;
    const network = req.query.network || DEFAULT_NETWORK;
    
    if (!hex) {
      return res.status(400).json({ 
        success: false, 
        error: 'Transaction hex is required' 
      });
    }
    
    const result = await bitcoinCli(`testmempoolaccept '["${hex}"]'`, network);
    const testResult = JSON.parse(result);
    
    res.json({ 
      success: true, 
      data: testResult,
      network
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get new address (for testing/demos)
app.get('/api/getnewaddress', async (req, res) => {
  try {
    const network = req.query.network || DEFAULT_NETWORK;
    const result = await bitcoinCli('getnewaddress', network);
    
    res.json({ 
      success: true, 
      address: result,
      network
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Send to address (for funding)
app.post('/api/sendtoaddress', async (req, res) => {
  try {
    const { address, amount } = req.body;
    const network = req.query.network || DEFAULT_NETWORK;
    
    if (!address || !amount) {
      return res.status(400).json({ 
        success: false, 
        error: 'Address and amount are required' 
      });
    }
    
    const result = await bitcoinCli(`sendtoaddress ${address} ${amount}`, network);
    
    res.json({ 
      success: true, 
      txid: result,
      address,
      amount,
      network
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Mine blocks (regtest only)
app.post('/api/generatetoaddress', async (req, res) => {
  try {
    const { blocks, address } = req.body;
    const network = req.query.network || DEFAULT_NETWORK;
    
    if (network !== 'regtest') {
      return res.status(400).json({ 
        success: false, 
        error: 'Mining only available on regtest network' 
      });
    }
    
    if (!blocks || !address) {
      return res.status(400).json({ 
        success: false, 
        error: 'Blocks count and address are required' 
      });
    }
    
    const result = await bitcoinCli(`generatetoaddress ${blocks} ${address}`, network);
    const hashes = JSON.parse(result);
    
    res.json({ 
      success: true, 
      blockhashes: hashes,
      count: hashes.length,
      network
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Generic bitcoin-cli command (admin use only - be careful!)
app.post('/api/execute', async (req, res) => {
  try {
    const { command } = req.body;
    const network = req.query.network || DEFAULT_NETWORK;
    
    if (!command) {
      return res.status(400).json({ 
        success: false, 
        error: 'Command is required' 
      });
    }
    
    // Blacklist dangerous commands
    const dangerousCommands = ['stop', 'setban', 'clearbanned', 'invalidateblock'];
    const commandLower = command.toLowerCase();
    
    if (dangerousCommands.some(cmd => commandLower.includes(cmd))) {
      return res.status(403).json({ 
        success: false, 
        error: 'Command not allowed' 
      });
    }
    
    const result = await bitcoinCli(command, network);
    
    // Try to parse as JSON, otherwise return as string
    let data;
    try {
      data = JSON.parse(result);
    } catch {
      data = result;
    }
    
    res.json({ 
      success: true, 
      data,
      network
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Start server
app.listen(PORT, () => {
  console.log('\n' + '='.repeat(60));
  console.log('  BITCOIN CLI PROXY SERVER');
  console.log('='.repeat(60));
  console.log(`\n✓ Server running on http://localhost:${PORT}`);
  console.log(`\n📡 Default network: ${DEFAULT_NETWORK}`);
  console.log('\n📚 Available endpoints:');
  console.log(`   GET  http://localhost:${PORT}/api/blockheight`);
  console.log(`   GET  http://localhost:${PORT}/api/blockchaininfo`);
  console.log(`   GET  http://localhost:${PORT}/api/transaction/:txid`);
  console.log(`   GET  http://localhost:${PORT}/api/transactions`);
  console.log(`   GET  http://localhost:${PORT}/api/listunspent`);
  console.log(`   POST http://localhost:${PORT}/api/sendrawtransaction`);
  console.log(`   POST http://localhost:${PORT}/api/testmempoolaccept`);
  console.log(`   POST http://localhost:${PORT}/api/generatetoaddress`);
  console.log('\n💡 Change network with ?network=regtest|testnet|mainnet');
  console.log('\n='.repeat(60) + '\n');
});

module.exports = app;
