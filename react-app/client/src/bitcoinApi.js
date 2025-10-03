/**
 * Bitcoin API Client
 * Communicates with the Bitcoin CLI proxy server
 */

const API_BASE_URL = import.meta.env.VITE_BITCOIN_API_URL || 'http://localhost:3001';

class BitcoinApiError extends Error {
  constructor(message, response) {
    super(message);
    this.name = 'BitcoinApiError';
    this.response = response;
  }
}

async function fetchApi(endpoint, options = {}) {
  try {
    const url = `${API_BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!data.success) {
      throw new BitcoinApiError(data.error || 'API request failed', data);
    }

    return data;
  } catch (error) {
    if (error instanceof BitcoinApiError) {
      throw error;
    }
    throw new BitcoinApiError(`Network error: ${error.message}`, null);
  }
}

export const bitcoinApi = {
  /**
   * Get current block height
   */
  async getBlockHeight(network = 'regtest') {
    const data = await fetchApi(`/api/blockheight?network=${network}`);
    return data.height;
  },

  /**
   * Get blockchain info
   */
  async getBlockchainInfo(network = 'regtest') {
    const data = await fetchApi(`/api/blockchaininfo?network=${network}`);
    return data.data;
  },

  /**
   * Get transaction details
   */
  async getTransaction(txid, network = 'regtest') {
    const data = await fetchApi(`/api/transaction/${txid}?network=${network}`);
    return data.data;
  },

  /**
   * Get raw transaction (decoded)
   */
  async getRawTransaction(txid, network = 'regtest') {
    const data = await fetchApi(`/api/rawtransaction/${txid}?network=${network}`);
    return data.data;
  },

  /**
   * List recent transactions
   */
  async listTransactions(count = 10, network = 'regtest') {
    const data = await fetchApi(`/api/transactions?count=${count}&network=${network}`);
    return data.data;
  },

  /**
   * List unspent outputs (UTXOs)
   */
  async listUnspent(address = null, minconf = 1, network = 'regtest') {
    let url = `/api/listunspent?minconf=${minconf}&network=${network}`;
    if (address) {
      url += `&address=${encodeURIComponent(address)}`;
    }
    const data = await fetchApi(url);
    return data.data;
  },

  /**
   * Broadcast a transaction
   */
  async sendRawTransaction(hex, network = 'regtest') {
    const data = await fetchApi(`/api/sendrawtransaction?network=${network}`, {
      method: 'POST',
      body: JSON.stringify({ hex }),
    });
    return data.txid;
  },

  /**
   * Test transaction without broadcasting
   */
  async testMempoolAccept(hex, network = 'regtest') {
    const data = await fetchApi(`/api/testmempoolaccept?network=${network}`, {
      method: 'POST',
      body: JSON.stringify({ hex }),
    });
    return data.data;
  },

  /**
   * Get a new address (for testing)
   */
  async getNewAddress(network = 'regtest') {
    const data = await fetchApi(`/api/getnewaddress?network=${network}`);
    return data.address;
  },

  /**
   * Mine blocks (regtest only)
   */
  async generateToAddress(blocks, address, network = 'regtest') {
    const data = await fetchApi(`/api/generatetoaddress?network=${network}`, {
      method: 'POST',
      body: JSON.stringify({ blocks, address }),
    });
    return data.blockhashes;
  },

  /**
   * Check if API is available
   */
  async checkHealth() {
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      return response.ok;
    } catch {
      return false;
    }
  },

  /**
   * Find UTXO for a specific address and amount
   */
  async findUtxoForAddress(address, minAmountBTC, network = 'regtest') {
    const utxos = await this.listUnspent(address, 1, network);
    
    // Filter UTXOs with sufficient amount
    const suitableUtxos = utxos.filter(utxo => utxo.amount >= minAmountBTC);
    
    if (suitableUtxos.length === 0) {
      return null;
    }
    
    // Return the first suitable UTXO
    return suitableUtxos[0];
  },

  /**
   * Get all UTXOs for an address
   */
  async getUtxosForAddress(address, network = 'regtest') {
    const utxos = await this.listUnspent(address, 0, network);
    return utxos;
  },
};

export { BitcoinApiError };
export default bitcoinApi;
