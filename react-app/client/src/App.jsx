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
        const utxos = await bitcoinApi.getUtxosForAddress(lock.lockupAddress, network);
        
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
      
      const txid = await bitcoinApi.sendToAddress(lock.lockupAddress, amountBTC, network);
      
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
      
      setStatus('Ready');
    } catch (error) {
      console.error('Error funding timelock:', error);
      showMessage(`✗ Failed to fund timelock: ${error.message}`, 'error');
      setStatus('Error');
    }
  };

  const handleCreateTimelock = () => {
    try {
      const result = walletService.createTimelock(blockHeight);
      showMessage('Timelock created successfully!', 'success');
      loadTimelocks();
      const s = walletService.getStatus();
      setStatus(s);
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
                    <span className="detail-value">{lock.lockupAddress}</span>
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
    </div>
  );
}

export default App;
