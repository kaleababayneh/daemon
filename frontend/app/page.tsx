'use client'

import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import { SmartAccountABI } from './abis/SmartAccount'
import { ERC20MockABI } from './abis/ERC20Mock'

// Contract addresses from ZK deployment
// Calculated smart account address using getCreateAddress with FACTORY_NONCE = 1
// This smart account is created by running: npx hardhat run zk-scripts/execute.ts --network localhost
const SMART_ACCOUNT_ADDRESS = '0xd8058efe0198ae9dD7D563e1b4938Dcbc86A1F81' // Hardcoded known address
const FACTORY_ADDRESS = '0xcf7ed3acca5a467e9e704c703e8d87f634fb0fc9' // Smart Account Factory
const ENTRY_POINT_ADDRESS = '0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0' // Entry Point
const ERC20_MOCK_ADDRESS = '0x5fc8d32690cc91d4c39d9d3abcbd16989f875707' // ERC20 Mock Token

interface AccountInfo {
  address: string
  owner: string
  guardianCommitment: string
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
    // ZK Recovery fields only
    guardianCommitment: '',
    nullifierHash: '',
    zkProof: '',
    // Recovery data from guardian (copy-paste format)
    recoveryData: '',
  })
  const [mintAmount, setMintAmount] = useState('1000')
  const [showGuardianTools, setShowGuardianTools] = useState(false)
  const [guardianForm, setGuardianForm] = useState({
    secretKey: '1',
    secretAnswer: '2',
    currentOwner: '',
    newOwner: ''
  })
  const [zkProgress, setZkProgress] = useState('')

  // Check if MetaMask is connected on component mount
  useEffect(() => {
    checkMetaMaskConnection()
  }, [])

  const checkMetaMaskConnection = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' })
        if (accounts.length > 0) {
          setAccount(accounts[0])
          setIsConnected(true)
          console.log('MetaMask already connected:', accounts[0])
          
          // Skip automatic smart account detection to avoid RPC errors
          // Instead, hardcode the known smart account
          setConnectedSmartAccounts([SMART_ACCOUNT_ADDRESS])
          setRecoveryForm(prev => ({ ...prev, smartAccountAddress: SMART_ACCOUNT_ADDRESS }))
          setStatus({ 
            type: 'success', 
            message: 'Wallet connected! Using known smart account.' 
          })
        }
      } catch (error) {
        console.error('Error checking MetaMask connection:', error)
      }
    }
  }

  // Proper disconnect function
  const disconnectWallet = () => {
    setAccount('')
    setIsConnected(false)
    setAccountInfo(null)
    setTokenInfo(null)
    setConnectedSmartAccounts([])
    setStatus({ type: 'info', message: 'Wallet disconnected' })
  }

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
        
        // Check for MetaMask JSON-RPC errors (usually network issues)
        if (error.message && error.message.includes('Internal JSON-RPC error')) {
          setStatus({ 
            type: 'error', 
            message: 'MetaMask network error. Please ensure you are connected to the correct network (localhost:8545) and try again. You may need to switch networks or reset MetaMask.' 
          })
          return
        }
        
        // Check if contract doesn't exist
        if (error.code === 'CALL_EXCEPTION') {
          setStatus({ 
            type: 'info', 
            message: 'Smart account not found at expected address. The smart account may not be created yet. Try using the factory to create it first.' 
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

  // Check if user is on the correct network
  const checkNetwork = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        const chainId = await window.ethereum.request({ method: 'eth_chainId' })
        // Hardhat localhost typically uses chainId 31337 (0x7a69)
        if (chainId !== '0x7a69') {
          setStatus({ 
            type: 'error', 
            message: `Wrong network! Please switch to Hardhat localhost (Chain ID: 31337). Current Chain ID: ${parseInt(chainId, 16)}` 
          })
          return false
        }
        return true
      } catch (error) {
        console.error('Error checking network:', error)
        return false
      }
    }
    return false
  }

  // Connect wallet
  const connectWallet = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        // First check if we're on the correct network
        const networkOk = await checkNetwork()
        if (!networkOk) {
          return // Error message already set by checkNetwork
        }
        
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
        if (accounts.length === 0) {
          setStatus({ type: 'error', message: 'No accounts found. Please unlock MetaMask.' })
          return
        }
        
        setAccount(accounts[0])
        setIsConnected(true)
        setStatus({ type: 'success', message: 'Wallet connected successfully' })
        console.log('Connected:', accounts[0])
        
        // Skip automatic smart account detection to avoid MetaMask RPC errors
        // Hardcode the known smart account instead
        setConnectedSmartAccounts([SMART_ACCOUNT_ADDRESS])
        setRecoveryForm(prev => ({ ...prev, smartAccountAddress: SMART_ACCOUNT_ADDRESS }))
        setStatus({ 
          type: 'success', 
          message: 'Wallet connected! Using known smart account: ' + SMART_ACCOUNT_ADDRESS.slice(0, 10) + '...' 
        })
        
        // Try to load account info, but don't fail if it errors
        try {
          await loadAccountInfo(SMART_ACCOUNT_ADDRESS)
        } catch (error) {
          console.log('Could not load account info, but continuing anyway:', error)
        }
      } catch (error: any) {
        console.error('Error connecting wallet:', error)
        if (error.code === 4001) {
          setStatus({ type: 'error', message: 'Connection rejected by user' })
        } else {
          setStatus({ type: 'error', message: 'Failed to connect wallet: ' + error.message })
        }
      }
    } else {
      setStatus({ type: 'error', message: 'MetaMask not detected. Please install MetaMask browser extension.' })
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
      setStatus({ type: 'info', message: 'Loading account information...' })
      
      const provider = new ethers.BrowserProvider(window.ethereum)
      const contract = new ethers.Contract(accountAddress, SmartAccountABI, provider)
      
      console.log('Fetching real data from smart contract...')
      
      // Actually fetch the real data from the smart contract
      const [owner, guardianCommitment] = await Promise.all([
        contract.owner(),
        contract.getGuardianCommitments()
      ])
      
      console.log('Fetched owner:', owner)
      console.log('Fetched guardian commitment:', guardianCommitment)
      
      // Get nonce (using 0 for simplicity since nonce queries can be complex)
      let nonce = 0
      try {
        // Try to get nonce, but don't fail if it errors
        nonce = Number(await contract.getNonce(owner))
      } catch (nonceError) {
        console.log('Could not fetch nonce, using 0:', nonceError)
      }

      setAccountInfo({
        address: accountAddress,
        owner,
        guardianCommitment,
        nonce
      })
      
      setStatus({ type: 'success', message: 'Account information loaded successfully from blockchain' })
      
      // Also load token info when account info is loaded
      await loadTokenInfo()
    } catch (error: any) {
      console.error('Error loading account info:', error)
      
      // If there's an RPC error, show a more specific message
      if (error.message && error.message.includes('Internal JSON-RPC error')) {
        setStatus({ type: 'error', message: 'MetaMask connection error. Please check your network connection and try again.' })
      } else {
        setStatus({ type: 'error', message: `Failed to load account info: ${error.message || error}` })
      }
      
      // Don't set hardcoded data on error, let user retry
    } finally {
      setLoading(false)
    }
  }

  // Set guardian (for account owner) - ZK commitment only
  const setGuardian = async () => {
    if (!isConnected || !account) {
      setStatus({ type: 'error', message: 'Please connect your wallet' })
      return
    }

    if (!recoveryForm.guardianCommitment) {
      setStatus({ type: 'error', message: 'Please provide guardian commitment hash' })
      return
    }

    try {
      setLoading(true)
      setStatus({ type: 'info', message: 'Setting guardian commitment...' })
      
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const contract = new ethers.Contract(recoveryForm.smartAccountAddress, SmartAccountABI, signer)
      
      console.log('Setting guardian commitment:', recoveryForm.guardianCommitment)
      console.log('Smart account address:', recoveryForm.smartAccountAddress)
      console.log('Signer address:', await signer.getAddress())
      
      // Use the commitment hash directly (bytes32)
      const tx = await contract.setGuardian(recoveryForm.guardianCommitment)
      setStatus({ type: 'info', message: 'Transaction submitted, waiting for confirmation...' })
      console.log('Transaction hash:', tx.hash)
      
      const receipt = await tx.wait()
      console.log('Transaction confirmed:', receipt)
      
      setStatus({ type: 'success', message: `Guardian commitment set successfully! Tx: ${tx.hash.slice(0, 10)}...` })
      
      // Update the account info to show the new commitment
      if (accountInfo) {
        setAccountInfo({
          ...accountInfo,
          guardianCommitment: recoveryForm.guardianCommitment
        })
      }
    } catch (error: any) {
      console.error('Error setting guardian:', error)
      
      if (error.code === 4001) {
        setStatus({ type: 'error', message: 'Transaction rejected by user' })
      } else if (error.message && error.message.includes('only owner')) {
        setStatus({ type: 'error', message: 'Only the owner can set guardian commitment' })
      } else {
        setStatus({ type: 'error', message: `Failed to set guardian: ${error.message || error}` })
      }
    } finally {
      setLoading(false)
    }
  }

  // Parse recovery data from guardian
  const parseRecoveryData = () => {
    if (!recoveryForm.recoveryData.trim()) {
      setStatus({ type: 'error', message: 'Please paste recovery data from guardian' })
      return
    }

    try {
      const recoveryPackage = JSON.parse(recoveryForm.recoveryData)
      
      // Validate required fields
      if (!recoveryPackage.nullifier_hash || !recoveryPackage.zk_proof || !recoveryPackage.new_owner) {
        throw new Error('Invalid recovery data format - missing required fields')
      }

      // Auto-fill the form with parsed data
      setRecoveryForm(prev => ({
        ...prev,
        nullifierHash: recoveryPackage.nullifier_hash,
        zkProof: recoveryPackage.zk_proof,
        newOwnerAddress: recoveryPackage.new_owner,
      }))

      setStatus({ 
        type: 'success', 
        message: `✅ Recovery data parsed successfully! New owner: ${recoveryPackage.new_owner.slice(0,6)}...${recoveryPackage.new_owner.slice(-4)}` 
      })

      console.log('Parsed recovery package:', {
        nullifier_hash: recoveryPackage.nullifier_hash,
        new_owner: recoveryPackage.new_owner,
        commitment: recoveryPackage.commitment,
        generated_at: recoveryPackage.generated_at,
        proof_length: recoveryPackage.proof_length
      })

    } catch (error: any) {
      setStatus({ type: 'error', message: `Failed to parse recovery data: ${error.message}` })
      console.error('Recovery data parsing error:', error)
    }
  }

  // ZK Recovery function
  const recoverAccountZK = async () => {
    if (!isConnected || !account || !accountInfo) {
      setStatus({ type: 'error', message: 'Please connect your wallet and load account info' })
      return
    }

    if (!recoveryForm.nullifierHash || !recoveryForm.zkProof) {
      setStatus({ type: 'error', message: 'Please provide nullifier hash and ZK proof' })
      return
    }

    try {
      setLoading(true)
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      
      // Call ZK recover function - specify the exact function signature
      const contract = new ethers.Contract(accountInfo.address, SmartAccountABI, signer)
      const tx = await contract['recoverAccount(address,uint256,bytes32,bytes)'](
        recoveryForm.newOwnerAddress,
        accountInfo.nonce,
        recoveryForm.nullifierHash,
        recoveryForm.zkProof
      )
      await tx.wait()
      
      setStatus({ type: 'success', message: 'Account recovered successfully using ZK proof!' })
      // Reload account info
      await loadAccountInfo(accountInfo.address)
    } catch (error) {
      console.error('Error recovering account with ZK:', error)
      setStatus({ type: 'error', message: 'Failed to recover account with ZK proof. Please check your nullifier hash and proof.' })
    } finally {
      setLoading(false)
    }
  }

  // Guardian Tools Functions
  const generateCommitment = async () => {
    try {
      setLoading(true)
      setZkProgress('Loading ZK modules...')
      
      // Dynamic import for client-side only
      const { generateCommitmentHash } = await import('../utils/zkProofs')
      
      setZkProgress('Generating commitment hash...')
      
      const commitment = await generateCommitmentHash(
        guardianForm.secretKey,
        guardianForm.secretAnswer
      )
      
      setStatus({ 
        type: 'success', 
        message: `Guardian commitment generated: ${commitment}` 
      })
      setZkProgress('')
    } catch (error) {
      console.error('Error generating commitment:', error)
      setStatus({ type: 'error', message: 'Failed to generate commitment hash' })
      setZkProgress('')
    } finally {
      setLoading(false)
    }
  }

  const generateRecoveryZKProof = async () => {
    try {
      setLoading(true)
      
      if (!guardianForm.currentOwner || !guardianForm.newOwner) {
        setStatus({ type: 'error', message: 'Please provide current and new owner addresses' })
        return
      }
      
      setZkProgress('Loading ZK modules...')
      
      // Dynamic import for client-side only
      const { generateRecoveryProof } = await import('../utils/zkProofs')
      
      const result = await generateRecoveryProof(
        guardianForm.secretKey,
        guardianForm.secretAnswer,
        guardianForm.currentOwner,
        guardianForm.newOwner,
        setZkProgress
      )
      
      // Auto-fill the recovery form
      setRecoveryForm(prev => ({
        ...prev,
        newOwnerAddress: guardianForm.newOwner,
        nullifierHash: result.nullifierHash,
        zkProof: result.zkProof
      }))
      
      setStatus({ 
        type: 'success', 
        message: `ZK proof generated successfully! Nullifier: ${result.nullifierHash.slice(0, 10)}...` 
      })
      setZkProgress('')
    } catch (error) {
      console.error('Error generating ZK proof:', error)
      setStatus({ type: 'error', message: 'Failed to generate ZK proof. Make sure the circuit is loaded correctly.' })
      setZkProgress('')
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
              <button className="button button-secondary" onClick={disconnectWallet}>
                Disconnect
              </button>
              <button 
                className="button button-secondary" 
                onClick={() => {
                  // Instead of scanning, just set the known smart account
                  setConnectedSmartAccounts([SMART_ACCOUNT_ADDRESS])
                  setRecoveryForm(prev => ({ ...prev, smartAccountAddress: SMART_ACCOUNT_ADDRESS }))
                  setStatus({ 
                    type: 'success', 
                    message: 'Using known smart account: ' + SMART_ACCOUNT_ADDRESS.slice(0, 10) + '...' 
                  })
                }}
                disabled={loading}
              >
                Use Known Smart Account
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2>Account Information</h2>
                <button
                  className="button button-secondary"
                  onClick={() => loadAccountInfo(accountInfo.address)}
                  disabled={loading}
                  style={{ fontSize: '14px', padding: '8px 16px' }}
                >
                  {loading ? 'Refreshing...' : '🔄 Refresh'}
                </button>
              </div>
              <div className="account-info">
                <h4>Smart Account:</h4>
                <p>{accountInfo.address}</p>
                <h4>Current Owner:</h4>
                <p>{accountInfo.owner}</p>
                <h4>Guardian Commitment:</h4>
                <p style={{ fontFamily: 'monospace', fontSize: '12px', wordBreak: 'break-all' }}>
                  {accountInfo.guardianCommitment === '0x0000000000000000000000000000000000000000000000000000000000000000' 
                    ? 'No guardian commitment set' 
                    : accountInfo.guardianCommitment
                  }
                </p>
                <h4>Nonce:</h4>
                <p>{accountInfo.nonce}</p>
                
                {/* Role Status */}
                <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                  <h4>Your Role Status:</h4>
                  <p><strong>Connected Address:</strong> {account}</p>
                  {account?.toLowerCase() === accountInfo.owner.toLowerCase() && (
                    <p style={{ color: '#059669' }}>✅ You are the <strong>Owner</strong> - You can set guardian commitments</p>
                  )}
                  <p style={{ color: '#6b7280' }}>� ZK Recovery - Anyone with valid nullifier hash and ZK proof can recover</p>
                </div>

               
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

      

          {/* Set Guardian (for owners) - ZK Commitment Only */}
          {accountInfo && account?.toLowerCase() === accountInfo.owner.toLowerCase() && (
            <div className="card">
              <h2>Set Guardian (ZK Privacy-Preserving)</h2>
              <p>As the account owner, you can set a guardian commitment hash for ZK-based recovery.</p>
              
              <div className="form-group">
                <label className="label">Guardian Commitment Hash:</label>
                <input
                  type="text"
                  className="input"
                  value={recoveryForm.guardianCommitment}
                  onChange={(e) => setRecoveryForm({ ...recoveryForm, guardianCommitment: e.target.value })}
                  placeholder="0x..."
                />
                <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                  This should be provided by your guardian. It's a privacy-preserving commitment hash computed off-chain.
                </p>
              </div>
              
              <button
                className="button"
                onClick={setGuardian}
                disabled={loading || !recoveryForm.guardianCommitment}
              >
                {loading ? 'Setting...' : 'Set Guardian Commitment'}
              </button>
            </div>
          )}

          {/* ZK Account Recovery */}
          {accountInfo && (
            <div className="card">
              <h2>ZK Account Recovery</h2>
              <p>Recover this account using ZK proof data from a guardian.</p>
              
            

              {/* Option 2: Manual Entry */}
              <div style={{ backgroundColor: '#fef3cd', padding: '15px', borderRadius: '4px', margin: '15px 0' }}>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>✏️ Recovery</h3>
                <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 10px 0' }}>
                  Manually enter recovery details (if you prefer not to copy-paste):
                </p>
              
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
                
                <div className="form-group">
                  <label className="label">Nullifier Hash:</label>
                  <input
                    type="text"
                    className="input"
                    value={recoveryForm.nullifierHash}
                    onChange={(e) => setRecoveryForm({ ...recoveryForm, nullifierHash: e.target.value })}
                    placeholder="0x..."
                  />
                  <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                    This should be provided by the guardian along with the ZK proof.
                  </p>
                </div>
                
                <div className="form-group">
                  <label className="label">ZK Proof:</label>
                  <textarea
                    className="input"
                    value={recoveryForm.zkProof}
                    onChange={(e) => setRecoveryForm({ ...recoveryForm, zkProof: e.target.value })}
                    placeholder="0x..."
                    rows={3}
                    style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '12px' }}
                  />
                  <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                    The ZK proof generated by the guardian for this recovery.
                  </p>
                </div>
              </div>
              
              {/* Submit Recovery */}
              <button
                className="button"
                onClick={recoverAccountZK}
                disabled={loading || !recoveryForm.newOwnerAddress || !recoveryForm.nullifierHash || !recoveryForm.zkProof}
                style={{ backgroundColor: '#dc2626', color: 'white', fontSize: '16px', padding: '12px 24px' }}
              >
                {loading ? 'Recovering Account...' : '🔓 Execute ZK Recovery'}
              </button>
              
              <p style={{ fontSize: '12px', color: '#dc2626', marginTop: '8px', fontWeight: '500' }}>
                ⚠️ This will transfer ownership to the new address. Make sure all details are correct!
              </p>
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