import React, { useState, useEffect } from 'react';
import * as walletService from './walletService';
import bitcoinApi from './bitcoinApi';
import './index.css';

function App() {
  const [walletInitialized, setWalletInitialized] = useState(false);
  const [mnemonic, setMnemonic] = useState('');
  const [network, setNetwork] = useState('regtest');
  const [timelocks, setTimelocks] = useState([]);
  const [status, setStatus] = useState(null);
  const [message, setMessage] = useState(null);
  const [currentBlockHeight, setCurrentBlockHeight] = useState(null);

  // Timelock creation form
  const [blockHeight, setBlockHeight] = useState(315);

  // Unlock form
  const [unlockTimelockId, setUnlockTimelockId] = useState('');
  const [unlockTxid, setUnlockTxid] = useState('');
  const [unlockVout, setUnlockVout] = useState(0);
  const [unlockAmount, setUnlockAmount] = useState(0.001);
  const [unlockFee, setUnlockFee] = useState(500);
  const [selectedTimelock, setSelectedTimelock] = useState(null);
  const [apiConnected, setApiConnected] = useState(false);
  const [releasedBalance, setReleasedBalance] = useState(null);
  const [releasedAddress, setReleasedAddress] = useState(null);
  const [recentTransactions, setRecentTransactions] = useState([]);

  // Check API connection
  useEffect(() => {
    const checkConnection = async () => {
      const connected = await bitcoinApi.checkHealth();
      setApiConnected(connected);
      if (!connected) {
        console.warn('Bitcoin API proxy not available. Block height will need manual updates.');
      }
    };
    checkConnection();
    const interval = setInterval(checkConnection, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Check if wallet is already initialized
    try {
      const s = walletService.getStatus();
      setWalletInitialized(true);
      setStatus(s);
      loadTimelocks();
    } catch (e) {
      // Wallet not initialized
    }
  }, []);

  // Fetch current block height
  const fetchBlockHeight = async () => {
    if (!apiConnected) return;
    
    try {
      const height = await bitcoinApi.getBlockHeight(network);
      setCurrentBlockHeight(height);
    } catch (error) {
      console.error('Could not fetch block height:', error.message);
      setMessage(`⚠️ Failed to fetch block height: ${error.message}`);
    }
  };

  useEffect(() => {
    if (walletInitialized && apiConnected) {
      fetchBlockHeight();
      // Auto-refresh every 10 seconds
      const interval = setInterval(fetchBlockHeight, 10000);
      return () => clearInterval(interval);
    }
  }, [walletInitialized, apiConnected, network]);

  const showMessage = (msg, type = 'info') => {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(null), 5000);
  };

  const initializeWallet = (useMnemonic = false) => {
    try {
      const mnemonicToUse = useMnemonic ? mnemonic : null;
      const result = walletService.initWallet(mnemonicToUse, false, network);
      setWalletInitialized(true);
      setMnemonic(result.mnemonic);
      const s = walletService.getStatus();
      setStatus(s);
      showMessage('Wallet initialized successfully!', 'success');
    } catch (error) {
      showMessage(`Error: ${error.message}`, 'error');
    }
  };

  const loadTimelocks = () => {
    try {
      const locks = walletService.getTimelocks();
      setTimelocks(locks);
    } catch (error) {
      showMessage(`Error: ${error.message}`, 'error');
    }
  };

  const selectTimelockForUnlock = async (lock) => {
    setSelectedTimelock(lock);
    setUnlockTimelockId(lock.id);
    
    // If API is connected, try to find UTXOs for this address
    if (apiConnected) {
      try {
        setStatus('Scanning for UTXOs...');
        const utxos = await bitcoinApi.getUtxosForAddress(lock.p2shAddress, network);
        
        if (utxos.length > 0) {
          // Auto-fill with the first UTXO found
          const utxo = utxos[0];
          setUnlockTxid(utxo.txid);
          setUnlockVout(utxo.vout);
          setUnlockAmount(utxo.amount);
          showMessage(`✓ Found UTXO: ${utxo.amount} BTC`, 'success');
          setStatus('UTXO found');
        } else {
          showMessage('No UTXOs found for this address. Enter manually or fund the address.', 'warning');
          setStatus('Ready');
        }
      } catch (error) {
        console.error('Error scanning for UTXOs:', error);
        showMessage('Could not scan for UTXOs. Enter manually.', 'warning');
        setStatus('Ready');
      }
    }
  };

  const handleMineBlocks = async () => {
    if (!apiConnected) {
      showMessage('Bitcoin API not connected', 'error');
      return;
    }

    if (network !== 'regtest') {
      showMessage('Mining only available on regtest network', 'error');
      return;
    }

    try {
      setStatus('Mining 5 blocks...');
      // Get a new address to mine to
      const address = await bitcoinApi.getNewAddress(network);
      const hashes = await bitcoinApi.generateToAddress(5, address, network);
      
      showMessage(`✓ Mined 5 blocks! New hashes: ${hashes.length}`, 'success');
      
      // Refresh block height
      await fetchBlockHeight();
      
      setStatus('Ready');
    } catch (error) {
      console.error('Error mining blocks:', error);
      showMessage(`✗ Failed to mine blocks: ${error.message}`, 'error');
      setStatus('Error');
    }
  };

  const fetchReleasedBalance = async (address) => {
    if (!apiConnected || !address) return;
    
    try {
      const utxos = await bitcoinApi.getUtxosForAddress(address, network);
      const totalBalance = utxos.reduce((sum, utxo) => sum + utxo.amount, 0);
      setReleasedBalance(totalBalance);
      setReleasedAddress(address);
      console.log(`💰 Released address balance: ${totalBalance} BTC at ${address}`);
    } catch (error) {
      console.error('Error fetching released balance:', error);
      setReleasedBalance(null);
    }
  };

  const decodeScriptType = (scriptPubKey) => {
    if (!scriptPubKey) return 'Unknown';
    
    const { type, hex, asm } = scriptPubKey;
    
    if (type === 'pubkeyhash') {
      return { type: 'P2PKH', description: 'Pay-to-Public-Key-Hash (Legacy)', color: '#8b5cf6' };
    } else if (type === 'scripthash') {
      return { type: 'P2SH', description: 'Pay-to-Script-Hash (Timelock)', color: '#f59e0b' };
    } else if (type === 'witness_v0_keyhash') {
      return { type: 'P2WPKH', description: 'Pay-to-Witness-Public-Key-Hash (SegWit)', color: '#10b981' };
    } else if (type === 'witness_v0_scripthash') {
      return { type: 'P2WSH', description: 'Pay-to-Witness-Script-Hash (SegWit Script)', color: '#06b6d4' };
    } else if (type === 'nulldata') {
      return { type: 'OP_RETURN', description: 'Data Output (No spend)', color: '#6b7280' };
    } else if (type === 'pubkey') {
      return { type: 'P2PK', description: 'Pay-to-Public-Key (Original)', color: '#ec4899' };
    } else if (type === 'witness_v1_taproot') {
      return { type: 'P2TR', description: 'Pay-to-Taproot (Latest)', color: '#8b5cf6' };
    }
    
    return { type: type || 'Unknown', description: asm || 'Custom Script', color: '#6b7280' };
  };

  // Determine if a transaction is locking or unlocking funds
  const getTimelockOperation = (tx) => {
    if (!tx) return { operation: 'Unknown', icon: '❓', color: '#6b7280' };
    
    const timelockAddresses = new Set(timelocks.map(lock => lock.p2shAddress));
    
    // Check if it's a receive to a timelock address (LOCKING)
    if (tx.category === 'receive' && tx.address && timelockAddresses.has(tx.address)) {
      return { operation: 'Lock Funds', icon: '🔒', color: '#dc2626' };
    }
    
    // If it's a send transaction, check decoded outputs and inputs
    if (tx.category === 'send' && tx.decoded) {
      // Check if spending FROM timelock (unlocking)
      if (tx.decoded.vin) {
        const spendsFromTimelock = tx.decoded.vin.some(input => {
          if (input.scriptSig && input.scriptSig.asm && 
              input.scriptSig.asm.includes('OP_CHECKLOCKTIMEVERIFY')) {
            return true;
          }
          if (input.txinwitness && input.txinwitness.length > 0) {
            const lastWitnessItem = input.txinwitness[input.txinwitness.length - 1];
            if (lastWitnessItem && lastWitnessItem.includes('b1')) {
              return true;
            }
          }
          return false;
        });
        if (spendsFromTimelock) {
          return { operation: 'Unlock Funds', icon: '�', color: '#059669' };
        }
      }
      
      // Check if sending TO a timelock address (funding)
      if (tx.decoded.vout) {
        const sendsToTimelock = tx.decoded.vout.some(output => {
          if (output.scriptPubKey && output.scriptPubKey.address) {
            return timelockAddresses.has(output.scriptPubKey.address);
          }
          return false;
        });
        if (sendsToTimelock) {
          return { operation: 'Fund Timelock', icon: '�', color: '#f59e0b' };
        }
      }
    }
    
    return { operation: 'Related', icon: '🔗', color: '#3b82f6' };
  };

  const fetchRecentTransactions = async () => {
    if (!apiConnected) return;
    
    try {
      const txList = await bitcoinApi.listTransactions(50, network);
      console.log(`📜 Found ${txList.length} wallet transactions`);
      
      // Get all P2SH addresses from timelocks (if any exist)
      const timelockAddresses = new Set(timelocks.map(lock => lock.p2shAddress));
      if (timelockAddresses.size > 0) {
        console.log(`🔍 Looking for transactions involving timelock addresses:`, Array.from(timelockAddresses));
      }
      
      // First, fetch decoded data for all transactions to check outputs
      const txsWithDecoded = await Promise.all(
        txList.map(async (tx) => {
          try {
            const decoded = await bitcoinApi.getTransactionDecoded(tx.txid, network);
            return {
              ...tx,
              decoded: decoded.decoded // Contains vout with scriptPubKey addresses
            };
          } catch (error) {
            console.error(`Could not decode tx ${tx.txid}:`, error.message);
            return tx; // Return without decoded data if fetch fails
          }
        })
      );
      
      // Filter for timelock-related transactions by checking decoded outputs
      const timelockTxs = txsWithDecoded.filter(tx => {
        // Show receives to timelock addresses (locking)
        if (tx.category === 'receive' && tx.address && timelockAddresses.has(tx.address)) {
          return true;
        }
        
        // For send transactions, check if ANY output goes to a timelock address
        if (tx.category === 'send' && tx.decoded && tx.decoded.vout) {
          const sendsToTimelock = tx.decoded.vout.some(output => {
            if (output.scriptPubKey && output.scriptPubKey.address) {
              return timelockAddresses.has(output.scriptPubKey.address);
            }
            return false;
          });
          
          // Also check if this spends FROM a timelock (unlock operation)
          // Look for P2SH witness script with CHECKLOCKTIMEVERIFY in inputs
          if (tx.decoded.vin) {
            const spendsFromTimelock = tx.decoded.vin.some(input => {
              // Check scriptSig for P2SH redeem script with CLTV
              if (input.scriptSig && input.scriptSig.asm && 
                  input.scriptSig.asm.includes('OP_CHECKLOCKTIMEVERIFY')) {
                return true;
              }
              // Check witness data for SegWit P2SH
              if (input.txinwitness && input.txinwitness.length > 0) {
                const lastWitnessItem = input.txinwitness[input.txinwitness.length - 1];
                // Decode hex and look for CLTV opcode (0xb1)
                if (lastWitnessItem && lastWitnessItem.includes('b1')) {
                  return true;
                }
              }
              return false;
            });
            if (spendsFromTimelock) return true;
          }
          
          return sendsToTimelock;
        }
        
        return false;
      }).slice(0, 10);
      
      setRecentTransactions(timelockTxs);
      console.log(`📜 Showing ${timelockTxs.length} timelock-related transactions (fund/lock/unlock)`);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    }
  };

  const handleFundTimelock = async (lock) => {
    if (!apiConnected) {
      showMessage('Bitcoin API not connected', 'error');
      return;
    }

    const defaultAmount = 0.001;
    const amount = prompt(
      `Enter amount to send to timelock #${lock.id} (BTC):`,
      defaultAmount.toString()
    );
    
    if (amount === null) {
      // User cancelled
      return;
    }

    const amountBTC = parseFloat(amount);
    if (isNaN(amountBTC) || amountBTC <= 0) {
      showMessage('Invalid amount', 'error');
      return;
    }

    try {
      setStatus(`Funding timelock #${lock.id}...`);
      
      const txid = await bitcoinApi.sendToAddress(lock.p2shAddress, amountBTC, network);
      
      showMessage(`✓ Sent ${amountBTC} BTC to timelock! TXID: ${txid}`, 'success');
      
      // Auto-mine a block on regtest to confirm
      if (network === 'regtest') {
        try {
          const address = await bitcoinApi.getNewAddress(network);
          await bitcoinApi.generateToAddress(1, address, network);
          showMessage(`✓ Mined confirmation block`, 'success');
          await fetchBlockHeight();
        } catch (mineError) {
          console.error('Could not mine confirmation block:', mineError);
        }
      }
      
      // Fetch transactions to show the funding tx
      await fetchRecentTransactions();
      
      setStatus('Ready');
    } catch (error) {
      console.error('Error funding timelock:', error);
      showMessage(`✗ Failed to fund timelock: ${error.message}`, 'error');
      setStatus('Error');
    }
  };

  const handleCreateTimelock = async () => {
    try {
      const result = walletService.createTimelock(blockHeight);
      showMessage('Timelock created successfully!', 'success');
      loadTimelocks();
      const s = walletService.getStatus();
      setStatus(s);
      
      // Fetch transactions to show any funding transactions
      await fetchRecentTransactions();
    } catch (error) {
      showMessage(`Error: ${error.message}`, 'error');
    }
  };

  const handleUnlockTimelock = async () => {
    console.log('🔓 handleUnlockTimelock called');
    console.log('Parameters:', { unlockTimelockId, unlockTxid, unlockVout, unlockAmount, unlockFee });
    
    try {
      // Check if timelock ID is provided
      if (unlockTimelockId === '' || unlockTimelockId === null || unlockTimelockId === undefined) {
        console.error('No timelock ID provided');
        showMessage('⚠️ Please select a timelock from the list below or enter a timelock ID', 'error');
        return;
      }
      
      const timelockId = parseInt(unlockTimelockId);
      if (isNaN(timelockId) || timelockId < 0) {
        console.error('Invalid timelock ID:', unlockTimelockId);
        showMessage('Please enter a valid timelock ID', 'error');
        return;
      }
      
      if (!unlockTxid || unlockTxid.trim() === '') {
        console.error('Missing TXID');
        showMessage('⚠️ Please provide a transaction ID (TXID). Select a timelock from the list to auto-fill, or enter manually.', 'error');
        return;
      }
      
      if (unlockVout === undefined || unlockVout === null) {
        console.error('Missing vout');
        showMessage('⚠️ Please provide the output index (vout)', 'error');
        return;
      }
      
      if (!unlockAmount || unlockAmount <= 0) {
        console.error('Invalid amount:', unlockAmount);
        showMessage('⚠️ Please provide a valid amount in BTC', 'error');
        return;
      }
      
      setStatus('Unlocking timelock...');
      console.log('Calling walletService.unlockTimelock...');
      
      const result = walletService.unlockTimelock(
        timelockId,
        unlockTxid,
        unlockVout,
        unlockAmount,
        unlockFee
      );
      
      console.log('✓ Transaction signed successfully');
      console.log('Signed Transaction:', result.signedTransaction);
      console.log('TXID:', result.txid);
      
      // Try to broadcast if API is connected
      if (apiConnected) {
        try {
          const broadcastTxid = await bitcoinApi.sendRawTransaction(result.signedTransaction, network);
          showMessage(`✓ Transaction broadcast successfully! TXID: ${broadcastTxid}`, 'success');
          setStatus('Transaction broadcast');
          
          // Auto-mine confirmation block on regtest
          if (network === 'regtest') {
            try {
              const address = await bitcoinApi.getNewAddress(network);
              await bitcoinApi.generateToAddress(1, address, network);
              showMessage(`✓ Mined confirmation block`, 'success');
              await fetchBlockHeight();
            } catch (mineError) {
              console.error('Could not mine confirmation block:', mineError);
            }
          }
          
          // Wait a moment for transaction to be indexed
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Fetch balance of released address after unlock
          if (result.to) {
            await fetchReleasedBalance(result.to);
          }
          
          // Fetch recent transactions to show the unlock transaction
          await fetchRecentTransactions();
          
          // Clear form after successful broadcast
          setUnlockTimelockId('');
          setUnlockTxid('');
          setUnlockVout(0);
          setUnlockAmount(0.001);
          setSelectedTimelock(null);
          
          loadTimelocks();
        } catch (broadcastError) {
          console.error('Broadcast error:', broadcastError);
          
          // Display transaction details for manual broadcast
          const txDisplay = `Transaction signed but broadcast failed: ${broadcastError.message}

Signed Transaction Details:
TXID: ${result.txid}
From: ${result.from}
To: ${result.to}
Amount: ${result.amountSatoshis} satoshis
Fee: ${result.feeSatoshis} satoshis

Hex: ${result.signedTransaction}

Broadcast manually with:
bitcoin-cli -${network} sendrawtransaction ${result.signedTransaction}`;
          
          alert(txDisplay);
          setStatus('Signed - manual broadcast needed');
          showMessage('Transaction signed. Please broadcast manually.', 'warning');
        }
      } else {
        // No API connection - show manual broadcast instructions
        const txDisplay = `Transaction signed successfully!

TXID: ${result.txid}
From: ${result.from}
To: ${result.to}
Amount: ${result.amountSatoshis} satoshis
Fee: ${result.feeSatoshis} satoshis

Hex: ${result.signedTransaction}

Broadcast with:
bitcoin-cli -${network} sendrawtransaction ${result.signedTransaction}`;
        
        alert(txDisplay);
        setStatus('Signed - awaiting broadcast');
        showMessage('Transaction signed. Connect API proxy to auto-broadcast.', 'info');
      }
      
      loadTimelocks();
    } catch (error) {
      console.error('❌ Error in handleUnlockTimelock:', error);
      console.error('Error stack:', error.stack);
      showMessage(`Error: ${error.message}`, 'error');
      setStatus('Error');
      
      // Show detailed error in alert for debugging
      alert(`Error unlocking timelock:\n\n${error.message}\n\nCheck browser console for details.`);
    }
  };

  const handleExport = () => {
    const state = walletService.exportState();
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `glacier-wallet-backup-${Date.now()}.json`;
    a.click();
    showMessage('Wallet exported!', 'success');
  };

  const handleImport = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const state = JSON.parse(e.target.result);
        walletService.importState(state);
        setWalletInitialized(true);
        setMnemonic(state.mnemonic);
        const s = walletService.getStatus();
        setStatus(s);
        loadTimelocks();
        showMessage('Wallet imported successfully!', 'success');
      } catch (error) {
        showMessage(`Error importing: ${error.message}`, 'error');
      }
    };
    reader.readAsText(file);
  };

  if (!walletInitialized) {
    return (
      <div className="app">
        <div className="header">
          <h1>🏔️ Glacier Timelock Wallet</h1>
          <p>Bitcoin HD Wallet with Time-Locked Transactions</p>
        </div>

        <div className="card">
          <h2>Initialize Wallet</h2>
          
          <div className="input-group">
            <label>Network</label>
            <select value={network} onChange={(e) => setNetwork(e.target.value)}>
              <option value="regtest">Regtest</option>
              <option value="testnet">Testnet</option>
              <option value="mainnet">Mainnet</option>
            </select>
          </div>

          <div className="button-group">
            <button className="button" onClick={() => initializeWallet(false)}>
              Create New Wallet
            </button>
          </div>

          <div style={{ margin: '20px 0', textAlign: 'center', color: '#666' }}>OR</div>

          <div className="input-group">
            <label>Import Existing Mnemonic (24 words)</label>
            <input
              type="text"
              value={mnemonic}
              onChange={(e) => setMnemonic(e.target.value)}
              placeholder="word1 word2 word3 ..."
            />
          </div>

          <button className="button button-secondary" onClick={() => initializeWallet(true)}>
            Import Wallet
          </button>

          <div style={{ margin: '20px 0', textAlign: 'center', color: '#666' }}>OR</div>

          <div className="input-group">
            <label>Import Wallet Backup</label>
            <input type="file" accept=".json" onChange={handleImport} />
          </div>

          {message && (
            <div className={`alert alert-${message.type}`}>
              {message.text}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="header">
        <h1>🏔️ Glacier Timelock Wallet</h1>
        <p>Bitcoin HD Wallet with Time-Locked Transactions</p>
      </div>

      {message && (
        <div className={`alert alert-${message.type}`}>
          {message.text}
        </div>
      )}

      {/* Wallet Status */}
      <div className="card">
        <h2>💼 Wallet Status</h2>
        
        {/* API Connection Status */}
        <div style={{ 
          marginBottom: '15px', 
          padding: '12px', 
          background: apiConnected ? '#d4edda' : '#f8d7da', 
          borderRadius: '6px',
          border: `1px solid ${apiConnected ? '#c3e6cb' : '#f5c6cb'}`
        }}>
          <p style={{ margin: 0, fontSize: '0.95rem' }}>
            <strong>Bitcoin API: </strong>
            {apiConnected ? (
              <span style={{ color: '#155724' }}>✓ Connected (auto-updating)</span>
            ) : (
              <span style={{ color: '#721c24' }}>✗ Disconnected - Start proxy server to continue</span>
            )}
          </p>
        </div>
        
        {status && (
          <div>
            <p><strong>Network:</strong> {status.network}</p>
            <p><strong>Lockup Index:</strong> {status.lockupIndex}</p>
            <p><strong>Released Index:</strong> {status.releasedIndex}</p>
            <p><strong>Total Timelocks:</strong> {status.totalTimelocks}</p>
          </div>
        )}
        
        {/* Current Block Height Display */}
        <div style={{ 
          marginTop: '15px', 
          padding: '15px', 
          background: currentBlockHeight ? '#e6f7ff' : '#fff3cd', 
          borderRadius: '6px',
          border: `1px solid ${currentBlockHeight ? '#91d5ff' : '#ffc107'}`
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '0.9rem' }}>
                Current Block Height
              </label>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: currentBlockHeight ? '#0050b3' : '#856404' }}>
                {currentBlockHeight ? currentBlockHeight.toLocaleString() : 'Waiting for connection...'}
              </div>
              <small style={{ color: '#666', fontSize: '0.85rem' }}>
                {apiConnected ? (
                  <span style={{ color: '#52c41a' }}>🔄 Auto-updating every 10s</span>
                ) : (
                  <span style={{ color: '#d46b08' }}>⚠️ Waiting for Bitcoin API</span>
                )}
              </small>
            </div>
            {apiConnected && (
              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  className="button"
                  style={{ padding: '8px 16px', fontSize: '0.9rem' }}
                  onClick={fetchBlockHeight}
                >
                  🔄 Refresh
                </button>
                {network === 'regtest' && (
                  <button 
                    className="button"
                    style={{ padding: '8px 16px', fontSize: '0.9rem', background: '#722ed1', borderColor: '#722ed1' }}
                    onClick={handleMineBlocks}
                    title="Mine 5 blocks (regtest only)"
                  >
                    ⛏️ Mine 5 Blocks
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        
        <div className="alert alert-warning" style={{ marginTop: '15px' }}>
          <strong>⚠️ BACKUP YOUR MNEMONIC:</strong>
          <div className="mnemonic-display">{mnemonic}</div>
        </div>

        <div className="button-group" style={{ marginTop: '15px' }}>
          <button className="button button-secondary" onClick={handleExport}>
            💾 Export Wallet
          </button>
        </div>
      </div>

      {/* Released Address Balance */}
      {releasedBalance !== null && releasedAddress && (
        <div className="card" style={{ background: '#f0fdf4', borderColor: '#86efac' }}>
          <h2>💰 Released Address Balance</h2>
          
          <div style={{ 
            padding: '20px', 
            background: 'white', 
            borderRadius: '8px',
            border: '2px solid #22c55e',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '8px' }}>
              Latest Unlock Destination
            </div>
            <div style={{ 
              fontSize: '2.5rem', 
              fontWeight: 'bold', 
              color: '#15803d',
              marginBottom: '12px'
            }}>
              {releasedBalance.toFixed(8)} BTC
            </div>
            <div style={{ 
              fontSize: '0.85rem', 
              color: '#666',
              wordBreak: 'break-all',
              fontFamily: 'monospace',
              background: '#f9fafb',
              padding: '8px 12px',
              borderRadius: '4px',
              border: '1px solid #e5e7eb'
            }}>
              {releasedAddress}
            </div>
            {apiConnected && (
              <button 
                className="button"
                style={{ 
                  marginTop: '15px', 
                  padding: '8px 16px', 
                  fontSize: '0.9rem',
                  background: '#22c55e',
                  borderColor: '#22c55e'
                }}
                onClick={() => fetchReleasedBalance(releasedAddress)}
              >
                🔄 Refresh Balance
              </button>
            )}
          </div>
          
          <div style={{ 
            marginTop: '15px', 
            padding: '12px', 
            background: '#fef3c7', 
            borderRadius: '6px',
            fontSize: '0.85rem',
            color: '#92400e'
          }}>
            <strong>ℹ️ Note:</strong> This shows the balance at the final destination address after successfully unlocking a timelock. It updates automatically when you click "Unlock Timelock".
          </div>
        </div>
      )}

      {/* Create Timelock */}
      <div className="card">
        <h2>🔒 Create Timelock</h2>
        
        {!apiConnected && (
          <div className="alert alert-danger" style={{ marginBottom: '15px' }}>
            <strong>⚠️ Bitcoin API Required:</strong> Start the proxy server to create timelocks.
          </div>
        )}
        
        {currentBlockHeight !== null && (
          <div className="alert alert-info" style={{ marginBottom: '15px' }}>
            <strong>ℹ️ Current Block Height:</strong> {currentBlockHeight}
          </div>
        )}
        
        <div className="input-group">
          <label>Block Height</label>
          <input
            type="number"
            value={blockHeight}
            onChange={(e) => setBlockHeight(parseInt(e.target.value))}
          />
          <small style={{ color: '#666', marginTop: '5px', display: 'block' }}>
            Enter a future block height when funds should unlock
          </small>
        </div>
        
        {currentBlockHeight !== null && (
          <div style={{ marginBottom: '15px' }}>
            <button 
              className="button" 
              style={{ marginRight: '10px', padding: '8px 16px', fontSize: '0.9rem' }}
              onClick={() => setBlockHeight(currentBlockHeight + 10)}
            >
              +10 blocks
            </button>
            <button 
              className="button" 
              style={{ marginRight: '10px', padding: '8px 16px', fontSize: '0.9rem' }}
              onClick={() => setBlockHeight(currentBlockHeight + 100)}
            >
              +100 blocks
            </button>
            <button 
              className="button" 
              style={{ padding: '8px 16px', fontSize: '0.9rem' }}
              onClick={() => setBlockHeight(currentBlockHeight + 1000)}
            >
              +1000 blocks
            </button>
          </div>
        )}
        
        <button 
          className="button" 
          onClick={handleCreateTimelock}
          disabled={!apiConnected || currentBlockHeight === null}
        >
          {apiConnected ? 'Create Timelock' : 'Waiting for Bitcoin API...'}
        </button>
      </div>

      {/* Unlock Timelock */}
      <div id="unlock-timelock-section" className="card">
        <h2>🔓 Unlock Timelock</h2>
        
        {selectedTimelock && (
          <div className="alert alert-info" style={{ marginBottom: '15px' }}>
            <strong>Selected:</strong> Timelock #{selectedTimelock.id} 
            <span style={{ marginLeft: '10px' }}>
              Block Height: {selectedTimelock.blockHeight}
            </span>
            {currentBlockHeight !== null && currentBlockHeight < selectedTimelock.blockHeight && (
              <span style={{ marginLeft: '10px', color: '#e53e3e' }}>
                ⚠️ Not yet unlockable ({selectedTimelock.blockHeight - currentBlockHeight} blocks remaining)
              </span>
            )}
          </div>
        )}
        
        <div className="form-row">
          <div className="input-group">
            <label>Timelock ID</label>
            <input
              type="text"
              value={unlockTimelockId}
              onChange={(e) => setUnlockTimelockId(e.target.value)}
              placeholder="Select from list below or enter ID"
            />
          </div>
          <div className="input-group">
            <label>TXID</label>
            <input
              type="text"
              value={unlockTxid}
              onChange={(e) => setUnlockTxid(e.target.value)}
              placeholder="Transaction ID"
            />
          </div>
        </div>
        <div className="form-row">
          <div className="input-group">
            <label>Vout</label>
            <input
              type="number"
              value={unlockVout}
              onChange={(e) => setUnlockVout(parseInt(e.target.value))}
            />
          </div>
          <div className="input-group">
            <label>Amount (BTC)</label>
            <input
              type="number"
              step="0.00000001"
              value={unlockAmount}
              onChange={(e) => setUnlockAmount(parseFloat(e.target.value))}
            />
          </div>
        </div>
        <div className="input-group">
          <label>Fee (Satoshis)</label>
          <input
            type="number"
            value={unlockFee}
            onChange={(e) => setUnlockFee(parseInt(e.target.value))}
          />
        </div>
        <button className="button button-secondary" onClick={handleUnlockTimelock}>
          Unlock Timelock
        </button>
      </div>

      {/* Timelocks List */}
      <div className="card">
        <h2>📋 Timelocks ({timelocks.length})</h2>
        {timelocks.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📭</div>
            <p>No timelocks created yet</p>
          </div>
        ) : (
          <div className="timelock-grid">
            {timelocks.map((lock) => (
              <div 
                key={lock.id} 
                className={`timelock-item ${selectedTimelock?.id === lock.id ? 'selected' : ''}`}
                style={{ 
                  cursor: lock.status === 'created' ? 'pointer' : 'default',
                  border: selectedTimelock?.id === lock.id ? '2px solid #667eea' : '2px solid #e2e8f0'
                }}
                onClick={() => lock.status === 'created' && selectTimelockForUnlock(lock)}
              >
                <div className="timelock-header">
                  <div className="timelock-id">Timelock #{lock.id}</div>
                  <span className={`status-badge status-${lock.status}`}>
                    {lock.status}
                  </span>
                </div>
                <div className="timelock-details">
                  <div className="detail-row">
                    <span className="detail-label">Block Height:</span>
                    <span className="detail-value">
                      {lock.blockHeight}
                      {currentBlockHeight !== null && lock.status === 'created' && (
                        <span style={{ 
                          marginLeft: '8px', 
                          fontSize: '0.85em',
                          color: currentBlockHeight >= lock.blockHeight ? '#38a169' : '#e53e3e'
                        }}>
                          {currentBlockHeight >= lock.blockHeight 
                            ? '✓ Unlockable' 
                            : `(${lock.blockHeight - currentBlockHeight} blocks)`
                          }
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">P2SH Address:</span>
                    <span className="detail-value">{lock.p2shAddress}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Lockup Address:</span>
                    <span className="detail-value">{lock.p2shAddress}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Released Address:</span>
                    <span className="detail-value">{lock.releasedAddress}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Created:</span>
                    <span className="detail-value">
                      {new Date(lock.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {lock.status === 'unlocked' && (
                    <>
                      <div className="detail-row">
                        <span className="detail-label">Unlocked:</span>
                        <span className="detail-value">
                          {new Date(lock.unlockedAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Unlock TXID:</span>
                        <span className="detail-value">{lock.unlockingTxid}</span>
                      </div>
                    </>
                  )}
                </div>
                {lock.status === 'created' && (
                  <div style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
                    <button 
                      className="button"
                      style={{ 
                        flex: 1, 
                        background: '#38a169', 
                        borderColor: '#38a169',
                        fontSize: '0.9rem'
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFundTimelock(lock);
                      }}
                      disabled={!apiConnected}
                      title="Send funds to this timelock's lockup address"
                    >
                      💰 Fund
                    </button>
                    <button 
                      className="button button-secondary"
                      style={{ flex: 1, fontSize: '0.9rem' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        selectTimelockForUnlock(lock);
                        // Scroll to unlock section
                        setTimeout(() => {
                          const unlockSection = document.getElementById('unlock-timelock-section');
                          if (unlockSection) {
                            unlockSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }
                        }, 100);
                      }}
                    >
                      Select to Unlock
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Transactions */}
      {recentTransactions.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h2>📜 Recent Transactions ({recentTransactions.length})</h2>
            {apiConnected && (
              <button 
                className="button"
                style={{ padding: '8px 16px', fontSize: '0.9rem' }}
                onClick={fetchRecentTransactions}
              >
                🔄 Refresh
              </button>
            )}
          </div>
          
          <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '15px' }}>
            Showing fund, lock, and unlock transactions
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {recentTransactions.map((tx, index) => {
              const operation = getTimelockOperation(tx);
              return (
              <div 
                key={tx.txid} 
                style={{ 
                  padding: '15px', 
                  background: '#f9fafb', 
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb'
                }}
              >
                {/* Transaction Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '4px' }}>
                      Transaction #{index + 1}
                    </div>
                    <div style={{ 
                      fontFamily: 'monospace', 
                      fontSize: '0.8rem', 
                      wordBreak: 'break-all',
                      color: '#374151'
                    }}>
                      {tx.txid}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {/* Operation Badge */}
                    <div style={{ 
                      padding: '4px 12px', 
                      background: operation.color,
                      color: 'white',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      whiteSpace: 'nowrap'
                    }}>
                      {operation.icon} {operation.operation}
                    </div>
                    {/* Confirmations Badge */}
                    <div style={{ 
                      padding: '4px 12px', 
                      background: tx.confirmations > 0 ? '#d1fae5' : '#fef3c7',
                      color: tx.confirmations > 0 ? '#065f46' : '#92400e',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      whiteSpace: 'nowrap'
                    }}>
                      {tx.confirmations > 0 ? `✓ ${tx.confirmations} conf` : '⏳ Pending'}
                    </div>
                  </div>
                </div>

                {/* Transaction Details */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px', fontSize: '0.85rem' }}>
                  <div>
                    <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>Category</div>
                    <div style={{ fontWeight: '600', color: '#1f2937' }}>
                      {tx.category === 'send' ? '📤 Send' : 
                       tx.category === 'receive' ? '📥 Receive' :
                       tx.category === 'generate' ? '⛏️ Mine' : tx.category}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>Amount</div>
                    <div style={{ 
                      fontWeight: '600',
                      color: tx.amount >= 0 ? '#059669' : '#dc2626'
                    }}>
                      {tx.amount >= 0 ? '+' : ''}{tx.amount.toFixed(8)} BTC
                    </div>
                  </div>
                  {tx.size && (
                    <div>
                      <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>Size</div>
                      <div style={{ fontWeight: '600', color: '#1f2937' }}>{tx.size} bytes</div>
                    </div>
                  )}
                </div>

                                {/* Transaction Details */}
                {tx.address && (
                  <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e5e7eb' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                      � Address
                    </div>
                    <div style={{ 
                      fontSize: '0.75rem', 
                      color: '#6b7280', 
                      fontFamily: 'monospace',
                      wordBreak: 'break-all'
                    }}>
                      {tx.address}
                    </div>
                  </div>
                )}
                
                {tx.fee && (
                  <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e5e7eb' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
                      💸 Transaction Fee
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#dc2626', fontWeight: '600' }}>
                      {Math.abs(tx.fee).toFixed(8)} BTC
                    </div>
                  </div>
                )}

                {/* Script Opcodes Section */}
                {tx.decoded && tx.decoded.vout && tx.decoded.vout.length > 0 && (
                  <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e5e7eb' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                      🔐 Script Opcodes ({tx.decoded.vout.length} output{tx.decoded.vout.length !== 1 ? 's' : ''})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {tx.decoded.vout.map((output, i) => {
                        const scriptInfo = decodeScriptType(output.scriptPubKey);
                        return (
                          <div key={i} style={{ 
                            background: '#f9fafb', 
                            padding: '10px', 
                            borderRadius: '6px',
                            border: '1px solid #e5e7eb'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                              <div style={{ 
                                fontSize: '0.7rem', 
                                color: '#6b7280',
                                fontWeight: '600'
                              }}>
                                Output #{i}:
                              </div>
                              <div style={{ 
                                padding: '2px 8px', 
                                background: scriptInfo.color,
                                color: 'white',
                                borderRadius: '4px',
                                fontSize: '0.7rem',
                                fontWeight: '600',
                                fontFamily: 'monospace'
                              }}>
                                {scriptInfo.type}
                              </div>
                              <div style={{ 
                                fontSize: '0.7rem', 
                                fontWeight: '600',
                                color: '#059669',
                                marginLeft: 'auto'
                              }}>
                                {output.value} BTC
                              </div>
                            </div>
                            
                            {output.scriptPubKey.asm && (
                              <div style={{ 
                                fontSize: '0.7rem', 
                                color: '#374151',
                                fontFamily: 'monospace',
                                background: 'white',
                                padding: '6px 8px',
                                borderRadius: '4px',
                                wordBreak: 'break-all',
                                lineHeight: '1.4'
                              }}>
                                <div style={{ color: '#9ca3af', marginBottom: '2px', fontSize: '0.65rem', fontWeight: '600' }}>
                                  ASM:
                                </div>
                                {output.scriptPubKey.asm}
                              </div>
                            )}
                            
                            {output.scriptPubKey.hex && (
                              <div style={{ 
                                fontSize: '0.65rem', 
                                color: '#6b7280',
                                fontFamily: 'monospace',
                                marginTop: '6px',
                                wordBreak: 'break-all',
                                lineHeight: '1.4'
                              }}>
                                <span style={{ color: '#9ca3af', fontWeight: '600' }}>HEX:</span> {output.scriptPubKey.hex}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Input Scripts with Opcodes */}
                {tx.decoded && tx.decoded.vin && tx.decoded.vin.length > 0 && (
                  <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e5e7eb' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                      📥 Input Scripts ({tx.decoded.vin.length} input{tx.decoded.vin.length !== 1 ? 's' : ''})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {tx.decoded.vin.map((input, i) => (
                        <div key={i} style={{ 
                          background: '#f9fafb', 
                          padding: '10px', 
                          borderRadius: '6px',
                          border: '1px solid #e5e7eb'
                        }}>
                          <div style={{ 
                            fontSize: '0.7rem', 
                            color: '#6b7280',
                            fontWeight: '600',
                            marginBottom: '6px'
                          }}>
                            {input.coinbase ? '⛏️ COINBASE (Mining Reward)' : `Input #${i}:`}
                          </div>
                          
                          {input.coinbase ? (
                            <div style={{ 
                              fontSize: '0.65rem', 
                              color: '#059669',
                              fontFamily: 'monospace',
                              wordBreak: 'break-all'
                            }}>
                              {input.coinbase}
                            </div>
                          ) : (
                            <>
                              {input.scriptSig && input.scriptSig.asm && (
                                <div style={{ 
                                  fontSize: '0.7rem', 
                                  color: '#374151',
                                  fontFamily: 'monospace',
                                  background: 'white',
                                  padding: '6px 8px',
                                  borderRadius: '4px',
                                  wordBreak: 'break-all',
                                  lineHeight: '1.4',
                                  marginBottom: '6px'
                                }}>
                                  <div style={{ color: '#9ca3af', marginBottom: '2px', fontSize: '0.65rem', fontWeight: '600' }}>
                                    scriptSig ASM:
                                  </div>
                                  {input.scriptSig.asm}
                                </div>
                              )}
                              
                              {input.txinwitness && input.txinwitness.length > 0 && (
                                <div style={{ 
                                  fontSize: '0.7rem', 
                                  color: '#374151',
                                  fontFamily: 'monospace',
                                  background: 'white',
                                  padding: '6px 8px',
                                  borderRadius: '4px',
                                  wordBreak: 'break-all',
                                  lineHeight: '1.4'
                                }}>
                                  <div style={{ color: '#9ca3af', marginBottom: '2px', fontSize: '0.65rem', fontWeight: '600' }}>
                                    Witness ({input.txinwitness.length} element{input.txinwitness.length !== 1 ? 's' : ''}):
                                  </div>
                                  {input.txinwitness.map((witness, wi) => (
                                    <div key={wi} style={{ marginTop: '4px', fontSize: '0.65rem' }}>
                                      [{wi}] {witness.substring(0, 64)}{witness.length > 64 ? '...' : ''}
                                    </div>
                                  ))}
                                </div>
                              )}
                              
                              <div style={{ 
                                fontSize: '0.65rem', 
                                color: '#6b7280',
                                fontFamily: 'monospace',
                                marginTop: '6px'
                              }}>
                                Spends: {input.txid?.substring(0, 16)}...:{input.vout}
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Timestamp */}
                {tx.blocktime && (
                  <div style={{ marginTop: '12px', fontSize: '0.75rem', color: '#9ca3af' }}>
                    ⏰ {new Date(tx.blocktime * 1000).toLocaleString()}
                  </div>
                )}
              </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
