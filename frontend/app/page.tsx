'use client'

import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import { SmartAccountABI } from './abis/SmartAccount'
import { ERC20MockABI } from './abis/ERC20Mock'

// Contract addresses from deployment
const SMART_ACCOUNT_ADDRESS = '0xa16E02E87b7454126E5E10d957A927A7F5B5d2be' // Replace with actual address
const FACTORY_ADDRESS = '0x5fbdb2315678afecb367f032d93f642f64180aa3' // Smart Account Factory
const ENTRY_POINT_ADDRESS = '0xe7f1725e7734ce288f8367e1bb143e90bb3f0512' // Entry Point
const ERC20_MOCK_ADDRESS = '0xcf7ed3acca5a467e9e704c703e8d87f634fb0fc9' // ERC20 Mock Token

interface AccountInfo {
  address: string
  owner: string
  guardian: string
  nonce: number
}

interface TokenInfo {
  name: string
  symbol: string
  decimals: number
  totalSupply: string
  smartAccountBalance: string
  walletBalance: string
}

declare global {
  interface Window {
    ethereum?: any
  }
}

export default function Home() {
  const [account, setAccount] = useState<string>('')
  const [isConnected, setIsConnected] = useState(false)
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null)
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null)
  const [connectedSmartAccounts, setConnectedSmartAccounts] = useState<string[]>([])
  const [skipAutoDetection, setSkipAutoDetection] = useState(false)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<{ type: 'info' | 'success' | 'error', message: string } | null>(null)
  const [recoveryForm, setRecoveryForm] = useState({
    smartAccountAddress: '',
    newOwnerAddress: '',
    guardianAddress: '',
  })
  const [mintAmount, setMintAmount] = useState('1000')

  // Find smart accounts associated with the connected wallet
  const findConnectedSmartAccounts = async (walletAddress: string) => {
    try {
      setLoading(true)
      const provider = new ethers.BrowserProvider(window.ethereum)
      const foundAccounts: string[] = []

      // Only check the known smart account address to avoid rate limiting
      try {
        // Add a small delay to avoid overwhelming MetaMask
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        const contract = new ethers.Contract(SMART_ACCOUNT_ADDRESS, SmartAccountABI, provider)
        const [owner, guardian] = await Promise.all([
          contract.owner(),
          contract.guardian()
        ])
        
        if (owner.toLowerCase() === walletAddress.toLowerCase() || 
            guardian.toLowerCase() === walletAddress.toLowerCase()) {
          foundAccounts.push(SMART_ACCOUNT_ADDRESS)
        }
      } catch (error: any) {
        console.log('Smart account check failed:', error.message)
        
        // Check if it's a circuit breaker error
        if (error.message && error.message.includes('circuit breaker')) {
          setStatus({ 
            type: 'error', 
            message: 'MetaMask circuit breaker is active. To fix this: 1) Close MetaMask completely, 2) Reopen MetaMask, 3) Try connecting again. Or wait 5-10 minutes for it to reset automatically.' 
          })
          return
        }
        
        // Check if contract doesn't exist
        if (error.code === 'CALL_EXCEPTION') {
          setStatus({ 
            type: 'info', 
            message: 'Smart account not found at expected address. Please manually enter your smart account address below.' 
          })
          return
        }
      }

      setConnectedSmartAccounts(foundAccounts)
      
      if (foundAccounts.length > 0) {
        setStatus({ 
          type: 'success', 
          message: `Found smart account associated with your wallet!` 
        })
        setRecoveryForm(prev => ({ ...prev, smartAccountAddress: foundAccounts[0] }))
        await loadAccountInfo(foundAccounts[0])
      } else {
        setStatus({ 
          type: 'info', 
          message: 'No smart accounts found. You can manually enter a smart account address below.' 
        })
      }
    } catch (error: any) {
      console.error('Error finding smart accounts:', error)
      setStatus({ 
        type: 'error', 
        message: 'Error scanning for smart accounts. Please try manually entering the address.' 
      })
    } finally {
      setLoading(false)
    }
  }

  // Connect wallet
  const connectWallet = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
        setAccount(accounts[0])
        setIsConnected(true)
        setStatus({ type: 'success', message: 'Wallet connected successfully' })
        
        // Only auto-detect if not skipping and not previously failed
        if (!skipAutoDetection) {
          try {
            await findConnectedSmartAccounts(accounts[0])
          } catch (error: any) {
            if (error.message && error.message.includes('circuit breaker')) {
              setSkipAutoDetection(true)
              setStatus({ 
                type: 'info', 
                message: 'Wallet connected! Please manually enter your smart account address below to continue.' 
              })
            }
          }
        } else {
          setStatus({ 
            type: 'info', 
            message: 'Wallet connected! Please manually enter your smart account address below to continue.' 
          })
        }
      } catch (error) {
        console.error('Error connecting wallet:', error)
        setStatus({ type: 'error', message: 'Failed to connect wallet' })
      }
    } else {
      setStatus({ type: 'error', message: 'Please install MetaMask' })
    }
  }

  // Retry function for circuit breaker
  const retryConnection = async () => {
    if (account) {
      setStatus({ type: 'info', message: 'Retrying connection...' })
      await findConnectedSmartAccounts(account)
    } else {
      await connectWallet()
    }
  }

  // Load token information
  const loadTokenInfo = async () => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const tokenContract = new ethers.Contract(ERC20_MOCK_ADDRESS, ERC20MockABI, provider)
      
      const [name, symbol, decimals, totalSupply] = await Promise.all([
        tokenContract.name(),
        tokenContract.symbol(),
        tokenContract.decimals(),
        tokenContract.totalSupply()
      ])

      let smartAccountBalance = '0'
      let walletBalance = '0'

      // Get smart account balance if available
      if (recoveryForm.smartAccountAddress) {
        smartAccountBalance = await tokenContract.balanceOf(recoveryForm.smartAccountAddress)
      }

      // Get wallet balance if connected
      if (account) {
        walletBalance = await tokenContract.balanceOf(account)
      }

      setTokenInfo({
        name,
        symbol,
        decimals: Number(decimals),
        totalSupply: ethers.formatUnits(totalSupply, decimals),
        smartAccountBalance: ethers.formatUnits(smartAccountBalance, decimals),
        walletBalance: ethers.formatUnits(walletBalance, decimals)
      })
    } catch (error) {
      console.error('Error loading token info:', error)
      setStatus({ type: 'error', message: 'Failed to load token information' })
    }
  }

  // Mint tokens to smart account
  const mintTokensToSmartAccount = async () => {
    if (!recoveryForm.smartAccountAddress || !mintAmount) {
      setStatus({ type: 'error', message: 'Please select a smart account and enter mint amount' })
      return
    }

    try {
      setLoading(true)
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const tokenContract = new ethers.Contract(ERC20_MOCK_ADDRESS, ERC20MockABI, signer)
      
      const decimals = tokenInfo?.decimals || 18
      const amount = ethers.parseUnits(mintAmount, decimals)
      
      const tx = await tokenContract.mint(recoveryForm.smartAccountAddress, amount)
      await tx.wait()
      
      setStatus({ type: 'success', message: `Successfully minted ${mintAmount} tokens to smart account!` })
      // Reload token info
      await loadTokenInfo()
    } catch (error) {
      console.error('Error minting tokens:', error)
      setStatus({ type: 'error', message: 'Failed to mint tokens' })
    } finally {
      setLoading(false)
    }
  }

  // Execute smart account transaction (demo with token transfer)
  const executeSmartAccountTx = async () => {
    if (!accountInfo || !account) {
      setStatus({ type: 'error', message: 'Please connect wallet and load smart account' })
      return
    }

    // Check if connected account is the owner
    if (account.toLowerCase() !== accountInfo.owner.toLowerCase()) {
      setStatus({ type: 'error', message: 'You must be the smart account owner to execute transactions' })
      return
    }

    try {
      setLoading(true)
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      
      // Create calldata for token transfer (transfer 100 tokens to your wallet)
      const tokenContract = new ethers.Contract(ERC20_MOCK_ADDRESS, ERC20MockABI)
      const decimals = tokenInfo?.decimals || 18
      const transferAmount = ethers.parseUnits('100', decimals)
      
      const transferCalldata = tokenContract.interface.encodeFunctionData('transfer', [
        account, // Transfer to your connected wallet
        transferAmount
      ])

      // Execute via smart account
      const smartAccountContract = new ethers.Contract(accountInfo.address, SmartAccountABI, signer)
      const tx = await smartAccountContract.execute(
        ERC20_MOCK_ADDRESS, // destination contract
        0, // value (0 ETH)
        transferCalldata // function call data
      )
      await tx.wait()
      
      setStatus({ type: 'success', message: 'Smart account transaction executed successfully! Transferred 100 tokens to your wallet.' })
      // Reload token info
      await loadTokenInfo()
    } catch (error) {
      console.error('Error executing smart account transaction:', error)
      setStatus({ type: 'error', message: 'Failed to execute smart account transaction' })
    } finally {
      setLoading(false)
    }
  }

  // Load account information
  const loadAccountInfo = async (accountAddress: string) => {
    try {
      setLoading(true)
      const provider = new ethers.BrowserProvider(window.ethereum)
      const contract = new ethers.Contract(accountAddress, SmartAccountABI, provider)
      
      const [owner, guardian] = await Promise.all([
        contract.owner(),
        contract.guardian()
      ])

      const nonce = await contract.getNonce(owner)

      setAccountInfo({
        address: accountAddress,
        owner,
        guardian,
        nonce: Number(nonce)
      })
      setStatus({ type: 'success', message: 'Account information loaded successfully' })
      
      // Also load token info when account info is loaded
      await loadTokenInfo()
    } catch (error) {
      console.error('Error loading account info:', error)
      setStatus({ type: 'error', message: 'Failed to load account information. Make sure the address is correct.' })
    } finally {
      setLoading(false)
    }
  }

  // Set guardian (for account owner)
  const setGuardian = async () => {
    if (!isConnected || !account) {
      setStatus({ type: 'error', message: 'Please connect your wallet' })
      return
    }

    try {
      setLoading(true)
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const contract = new ethers.Contract(recoveryForm.smartAccountAddress, SmartAccountABI, signer)
      
      const tx = await contract.setGuardian(recoveryForm.guardianAddress)
      await tx.wait()
      
      setStatus({ type: 'success', message: 'Guardian set successfully!' })
      // Reload account info
      await loadAccountInfo(recoveryForm.smartAccountAddress)
    } catch (error) {
      console.error('Error setting guardian:', error)
      setStatus({ type: 'error', message: 'Failed to set guardian. Make sure you are the owner of this account.' })
    } finally {
      setLoading(false)
    }
  }

  // Recover account (for guardian)
  const recoverAccount = async () => {
    if (!isConnected || !account || !accountInfo) {
      setStatus({ type: 'error', message: 'Please connect your wallet and load account info' })
      return
    }

    try {
      setLoading(true)
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      
      // Create EIP-712 signature
      const domain = {
        name: 'SmartAccount',
        version: '1',
        chainId: 31337, // localhost
        verifyingContract: accountInfo.address
      }

      const types = {
        Recover: [
          { name: 'currentOwner', type: 'address' },
          { name: 'newOwner', type: 'address' },
          { name: 'nonce', type: 'uint256' }
        ]
      }

      const message = {
        currentOwner: accountInfo.owner,
        newOwner: recoveryForm.newOwnerAddress,
        nonce: accountInfo.nonce
      }

      const signature = await signer.signTypedData(domain, types, message)
      
      // Call recover function
      const contract = new ethers.Contract(accountInfo.address, SmartAccountABI, signer)
      const tx = await contract.recoverAccount(
        recoveryForm.newOwnerAddress,
        accountInfo.nonce,
        signature
      )
      await tx.wait()
      
      setStatus({ type: 'success', message: 'Account recovered successfully!' })
      // Reload account info
      await loadAccountInfo(accountInfo.address)
    } catch (error) {
      console.error('Error recovering account:', error)
      setStatus({ type: 'error', message: 'Failed to recover account. Make sure you are the guardian.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container">
      <h1>Smart Account Recovery</h1>
      
      {/* Wallet Connection */}
      <div className="card">
        <h2>Wallet Connection</h2>
        {!isConnected ? (
          <button className="button" onClick={connectWallet}>
            Connect MetaMask
          </button>
        ) : (
          <div>
            <p><strong>Connected:</strong> {account}</p>
            <div className="button-group">
              <button className="button button-secondary" onClick={() => setIsConnected(false)}>
                Disconnect
              </button>
              <button 
                className="button button-secondary" 
                onClick={() => findConnectedSmartAccounts(account)}
                disabled={loading}
              >
                {loading ? 'Scanning...' : 'Refresh Smart Accounts'}
              </button>
            </div>
          </div>
        )}
      </div>

      {isConnected && (
        <>
          {/* Connected Smart Accounts */}
          {connectedSmartAccounts.length > 0 && (
            <div className="card">
              <h2>Your Smart Accounts</h2>
              <p>Found {connectedSmartAccounts.length} smart account(s) associated with your wallet:</p>
              <div style={{ marginBottom: '16px' }}>
                {connectedSmartAccounts.map((address, index) => (
                  <div 
                    key={address} 
                    className={`smart-account-item ${recoveryForm.smartAccountAddress === address ? 'selected' : ''}`}
                  >
                    <div>
                      <h4 style={{ margin: '0 0 4px 0', color: '#374151' }}>Smart Account #{index + 1}</h4>
                      <p style={{ margin: '0', fontFamily: 'monospace', fontSize: '12px', color: '#6b7280' }}>
                        {address}
                      </p>
                    </div>
                    <button
                      className="button"
                      onClick={() => {
                        setRecoveryForm(prev => ({ ...prev, smartAccountAddress: address }))
                        loadAccountInfo(address)
                      }}
                      disabled={loading}
                    >
                      {recoveryForm.smartAccountAddress === address ? 'Selected' : 'Select'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Load Account Info */}
          <div className="card">
            <h2>
              {connectedSmartAccounts.length > 0 
                ? 'Load Other Smart Account' 
                : 'Load Smart Account Information'
              }
            </h2>
            {connectedSmartAccounts.length > 0 && (
              <p>Or enter a different smart account address manually:</p>
            )}
            {skipAutoDetection && (
              <div style={{ backgroundColor: '#f0f8ff', padding: '10px', borderRadius: '4px', marginBottom: '10px' }}>
                <p><strong>💡 Hint:</strong> Based on our deployment, your smart account should be at:</p>
                <p style={{ fontFamily: 'monospace', fontSize: '14px', backgroundColor: '#fff', padding: '5px', borderRadius: '3px' }}>
                  0xa16E02E87b7454126E5E10d957A927A7F5B5d2be
                </p>
                <button 
                  className="button" 
                  style={{ fontSize: '12px', padding: '5px 10px', marginTop: '5px' }}
                  onClick={() => {
                    setRecoveryForm(prev => ({ ...prev, smartAccountAddress: '0xa16E02E87b7454126E5E10d957A927A7F5B5d2be' }))
                  }}
                >
                  Use This Address
                </button>
              </div>
            )}
            <div className="form-group">
              <label className="label">Smart Account Address:</label>
              <input
                type="text"
                className="input"
                value={recoveryForm.smartAccountAddress}
                onChange={(e) => setRecoveryForm({ ...recoveryForm, smartAccountAddress: e.target.value })}
                placeholder="0x..."
              />
            </div>
            <button
              className="button"
              onClick={() => loadAccountInfo(recoveryForm.smartAccountAddress)}
              disabled={loading || !recoveryForm.smartAccountAddress}
            >
              {loading ? 'Loading...' : 'Load Account Info'}
            </button>
          </div>

          {/* Account Information */}
          {accountInfo && (
            <div className="card">
              <h2>Account Information</h2>
              <div className="account-info">
                <h4>Smart Account:</h4>
                <p>{accountInfo.address}</p>
                <h4>Current Owner:</h4>
                <p>{accountInfo.owner}</p>
                <h4>Guardian:</h4>
                <p>{accountInfo.guardian || 'No guardian set'}</p>
                <h4>Nonce:</h4>
                <p>{accountInfo.nonce}</p>
                
                {/* Role Status */}
                <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                  <h4>Your Role Status:</h4>
                  <p><strong>Connected Address:</strong> {account}</p>
                  {account?.toLowerCase() === accountInfo.owner.toLowerCase() && (
                    <p style={{ color: '#059669' }}>✅ You are the <strong>Owner</strong> - You can set guardians</p>
                  )}
                  {account?.toLowerCase() === accountInfo.guardian.toLowerCase() && (
                    <p style={{ color: '#dc2626' }}>🛡️ You are the <strong>Guardian</strong> - You can recover this account</p>
                  )}
                  {account?.toLowerCase() !== accountInfo.owner.toLowerCase() && 
                   account?.toLowerCase() !== accountInfo.guardian.toLowerCase() && (
                    <p style={{ color: '#6b7280' }}>👀 You are a <strong>Viewer</strong> - Read-only access</p>
                  )}
                </div>

                {/* Testing Instructions */}
                {account?.toLowerCase() !== accountInfo.owner.toLowerCase() && 
                 account?.toLowerCase() !== accountInfo.guardian.toLowerCase() && (
                  <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#fef3c7', borderRadius: '4px' }}>
                    <h4>🧪 To Test Recovery:</h4>
                    <ol>
                      <li>First, import the <strong>owner's private key</strong> into MetaMask:
                        <br />
                        <code style={{ backgroundColor: '#fff', padding: '2px 4px', borderRadius: '2px', fontSize: '12px' }}>
                          0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
                        </code>
                      </li>
                      <li>Switch to that account and set yourself as guardian</li>
                      <li>Switch back to your account</li>
                      <li>Refresh the page - you'll see the recovery section!</li>
                    </ol>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ERC20 Token Information & Actions */}
          {accountInfo && (
            <div className="card">
              <h2>ERC20 Mock Token ({ERC20_MOCK_ADDRESS})</h2>
              {tokenInfo ? (
                <div>
                  <div className="account-info">
                    <h4>Token Name:</h4>
                    <p>{tokenInfo.name} ({tokenInfo.symbol})</p>
                    <h4>Total Supply:</h4>
                    <p>{tokenInfo.totalSupply} {tokenInfo.symbol}</p>
                    <h4>Smart Account Balance:</h4>
                    <p>{tokenInfo.smartAccountBalance} {tokenInfo.symbol}</p>
                    <h4>Your Wallet Balance:</h4>
                    <p>{tokenInfo.walletBalance} {tokenInfo.symbol}</p>
                  </div>
                  
                  <div style={{ marginTop: '20px' }}>
                    <h3>Token Actions</h3>
                    
                    {/* Mint Tokens */}
                    <div className="form-group">
                      <label className="label">Mint Tokens to Smart Account:</label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                          type="number"
                          className="input"
                          value={mintAmount}
                          onChange={(e) => setMintAmount(e.target.value)}
                          placeholder="Amount to mint"
                          style={{ flex: 1 }}
                        />
                        <button
                          className="button"
                          onClick={mintTokensToSmartAccount}
                          disabled={loading || !mintAmount}
                        >
                          {loading ? 'Minting...' : 'Mint Tokens'}
                        </button>
                      </div>
                    </div>

                    {/* Execute Smart Account Transaction */}
                    {account?.toLowerCase() === accountInfo.owner.toLowerCase() && (
                      <div className="form-group">
                        <label className="label">Smart Account Execution Demo:</label>
                        <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>
                          Execute a transaction through your smart account (transfer 100 tokens to your wallet)
                        </p>
                        <button
                          className="button"
                          onClick={executeSmartAccountTx}
                          disabled={loading || parseFloat(tokenInfo.smartAccountBalance) < 100}
                        >
                          {loading ? 'Executing...' : 'Execute Smart Account Transfer'}
                        </button>
                        {parseFloat(tokenInfo.smartAccountBalance) < 100 && (
                          <p style={{ fontSize: '12px', color: '#dc2626', marginTop: '4px' }}>
                            Smart account needs at least 100 tokens to execute this demo
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <p>Loading token information...</p>
                  <button className="button" onClick={loadTokenInfo} disabled={loading}>
                    {loading ? 'Loading...' : 'Load Token Info'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Set Guardian (for owners) */}
          {accountInfo && account?.toLowerCase() === accountInfo.owner.toLowerCase() && (
            <div className="card">
              <h2>Set Guardian</h2>
              <p>As the account owner, you can set a guardian for recovery purposes.</p>
              <div className="form-group">
                <label className="label">Guardian Address:</label>
                <input
                  type="text"
                  className="input"
                  value={recoveryForm.guardianAddress}
                  onChange={(e) => setRecoveryForm({ ...recoveryForm, guardianAddress: e.target.value })}
                  placeholder="0x..."
                />
              </div>
              <button
                className="button"
                onClick={setGuardian}
                disabled={loading || !recoveryForm.guardianAddress}
              >
                {loading ? 'Setting...' : 'Set Guardian'}
              </button>
            </div>
          )}

          {/* Account Recovery (for guardians) */}
          {accountInfo && account?.toLowerCase() === accountInfo.guardian.toLowerCase() && (
            <div className="card">
              <h2>Recover Account</h2>
              <p>As the guardian, you can recover this account to a new owner.</p>
              <div className="form-group">
                <label className="label">New Owner Address:</label>
                <input
                  type="text"
                  className="input"
                  value={recoveryForm.newOwnerAddress}
                  onChange={(e) => setRecoveryForm({ ...recoveryForm, newOwnerAddress: e.target.value })}
                  placeholder="0x..."
                />
              </div>
              <button
                className="button"
                onClick={recoverAccount}
                disabled={loading || !recoveryForm.newOwnerAddress}
              >
                {loading ? 'Recovering...' : 'Recover Account'}
              </button>
            </div>
          )}

          {/* Instructions for non-owners/non-guardians */}
          {accountInfo && 
           account?.toLowerCase() !== accountInfo.owner.toLowerCase() && 
           account?.toLowerCase() !== accountInfo.guardian.toLowerCase() && (
            <div className="card">
              <h2>Testing Recovery</h2>
              <p>You're viewing as a non-owner/non-guardian. To test recovery:</p>
              <div style={{ backgroundColor: '#f0f8ff', padding: '15px', borderRadius: '4px', margin: '10px 0' }}>
                <h4>Option 1: Import Owner Account</h4>
                <p>Import this private key into MetaMask:</p>
                <code style={{ backgroundColor: '#fff', padding: '8px', display: 'block', borderRadius: '4px', fontSize: '12px', wordBreak: 'break-all' }}>
                  0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
                </code>
                <p style={{ fontSize: '12px', marginTop: '5px' }}>This is Hardhat's default account #1 (safe for testing)</p>
              </div>
              <div style={{ backgroundColor: '#f0fdf4', padding: '15px', borderRadius: '4px', margin: '10px 0' }}>
                <h4>Option 2: Set Current Account as Guardian</h4>
                <p>If you can access the owner account, set your current account ({account}) as the guardian, then reload this page.</p>
              </div>
            </div>
          )}
        </>
      )}

      {/* Status Messages */}
      {status && (
        <div className={`status-box status-${status.type}`}>
          {status.message}
          {status.message.includes('circuit breaker') && (
            <div style={{ marginTop: '10px' }}>
              <button 
                className="button" 
                onClick={retryConnection}
                disabled={loading}
              >
                {loading ? 'Retrying...' : 'Retry Connection'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}