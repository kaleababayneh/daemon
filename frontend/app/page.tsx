'use client'

import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import { SmartAccountABI } from './abis/SmartAccount'
import { ERC20MockABI } from './abis/ERC20Mock'
import { CONTRACT_ADDRESSES } from './config'

// Use contract addresses from config
const SMART_ACCOUNT_ADDRESS = CONTRACT_ADDRESSES.smartAccount
const FACTORY_ADDRESS = CONTRACT_ADDRESSES.smartAccountFactory  
const ENTRY_POINT_ADDRESS = CONTRACT_ADDRESSES.entryPoint
const ERC20_MOCK_ADDRESS = CONTRACT_ADDRESSES.erc20Mock

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
    // Recovery target address (manual input)
    recoveryTargetAddress: '',
    // ZK Recovery fields only
    guardianCommitment: '',
    guardianCommitmentForRecovery: '', // Commitment hash for recovery
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

  // Auto-populate new owner address when account changes
  useEffect(() => {
    if (account) {
      setRecoveryForm(prev => ({ ...prev, newOwnerAddress: account }))
    }
  }, [account])

  const checkMetaMaskConnection = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' })
        if (accounts.length > 0) {
          setAccount(accounts[0])
          setIsConnected(true)
          console.log('MetaMask already connected:', accounts[0])
          
          // Find smart accounts owned by this wallet
          if (!skipAutoDetection) {
            await findConnectedSmartAccounts(accounts[0])
          } else {
            setStatus({ 
              type: 'info', 
              message: 'Wallet connected! Auto-detection skipped. Enter smart account address manually below.' 
            })
          }
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
        
        // Use checksummed address to avoid ENS resolution
        const checksummedSmartAccountAddress = ethers.getAddress(SMART_ACCOUNT_ADDRESS)
        const contract = new ethers.Contract(checksummedSmartAccountAddress, SmartAccountABI, provider)
        const owner = await contract.owner()
        
        // Privacy-first: Only show accounts where connected wallet is the owner
        if (owner.toLowerCase() === walletAddress.toLowerCase()) {
          foundAccounts.push(checksummedSmartAccountAddress)
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
            message: 'MetaMask network error. Please ensure you are connected to Linea Sepolia and try again. You may need to switch networks or reset MetaMask.' 
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
          message: `Found ${foundAccounts.length} smart account(s) owned by your wallet!` 
        })
        setRecoveryForm(prev => ({ ...prev, smartAccountAddress: foundAccounts[0] }))
        await loadAccountInfo(foundAccounts[0])
      } else {
        setStatus({ 
          type: 'info', 
          message: 'No smart accounts owned by your wallet found. You can manually enter a smart account address below (only if you own it).' 
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

  // Check if user is on the correct network and offer to switch
  const checkNetwork = async () => {
    const chainId = await window.ethereum.request({ method: 'eth_chainId' })
    const supportedChains = ['0xe705'] // Linea Sepolia (59141)
    if (!supportedChains.includes(chainId)) {
      setStatus({ 
        type: 'error', 
        message: `Wrong network! Please switch to Linea Sepolia (Chain ID: 59141). Current Chain ID: ${parseInt(chainId, 16)}` 
      })
      return false
    }
    return true
  }

  // Switch to Linea Sepolia network
  const switchToLineaSepolia = async () => {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0xe705' }], // Linea Sepolia
      })
      setStatus({ type: 'success', message: 'Switched to Linea Sepolia network!' })
      return true
    } catch (switchError: any) {
      // This error code indicates that the chain has not been added to MetaMask
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: '0xe705',
                chainName: 'Linea Sepolia',
                nativeCurrency: {
                  name: 'ETH',
                  symbol: 'ETH',
                  decimals: 18,
                },
                rpcUrls: ['https://rpc.sepolia.linea.build'],
                blockExplorerUrls: ['https://sepolia.lineascan.build'],
              },
            ],
          })
          setStatus({ type: 'success', message: 'Linea Sepolia network added and switched!' })
          return true
        } catch (addError) {
          setStatus({ type: 'error', message: 'Failed to add Linea Sepolia network' })
          return false
        }
      } else {
        setStatus({ type: 'error', message: 'Failed to switch to Linea Sepolia network' })
        return false
      }
    }
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
        
        // Find smart accounts owned by this wallet
        if (!skipAutoDetection) {
          await findConnectedSmartAccounts(accounts[0])
        } else {
          setStatus({ 
            type: 'info', 
            message: 'Wallet connected! Auto-detection skipped. Enter smart account address manually below.' 
          })
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
      // Use checksummed address to avoid ENS resolution
      const checksummedTokenAddress = ethers.getAddress(ERC20_MOCK_ADDRESS)
      const tokenContract = new ethers.Contract(checksummedTokenAddress, ERC20MockABI, provider)
      
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
        const checksummedSmartAccountAddress = ethers.getAddress(recoveryForm.smartAccountAddress)
        smartAccountBalance = await tokenContract.balanceOf(checksummedSmartAccountAddress)
      }

      // Get wallet balance if connected
      if (account) {
        const checksummedWalletAddress = ethers.getAddress(account)
        walletBalance = await tokenContract.balanceOf(checksummedWalletAddress)
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
      // Use checksummed addresses to avoid ENS resolution
      const checksummedTokenAddress = ethers.getAddress(ERC20_MOCK_ADDRESS)
      const checksummedSmartAccountAddress = ethers.getAddress(recoveryForm.smartAccountAddress)
      const tokenContract = new ethers.Contract(checksummedTokenAddress, ERC20MockABI, signer)
      
      const decimals = tokenInfo?.decimals || 18
      const amount = ethers.parseUnits(mintAmount, decimals)
      
      const tx = await tokenContract.mint(checksummedSmartAccountAddress, amount)
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
      
      if (!account) {
        setStatus({ type: 'error', message: 'Please connect your wallet first' })
        setLoading(false)
        return
      }
      
      const provider = new ethers.BrowserProvider(window.ethereum)
      // Use checksummed address to avoid ENS resolution
      const checksummedAddress = ethers.getAddress(accountAddress)
      const contract = new ethers.Contract(checksummedAddress, SmartAccountABI, provider)
      
      console.log('Fetching owner from smart contract...')
      
      // First, check who the owner is
      const owner = await contract.owner()
      console.log('Smart account owner:', owner)
      console.log('Connected wallet:', account)
      
      // Privacy check: Only show account info if the connected wallet is the owner
      if (account.toLowerCase() !== owner.toLowerCase()) {
        setStatus({ 
          type: 'error', 
          message: `Access Denied: This smart account is owned by ${owner.slice(0, 6)}...${owner.slice(-4)}. Only the owner can view account information for privacy.` 
        })
        setAccountInfo(null)
        setLoading(false)
        return
      }
      
      console.log('✅ Owner verification passed - loading account details...')
      
      // Only if owner verification passes, load the full account info
      const [guardianCommitment] = await Promise.all([
        contract.getGuardianCommitments()
      ])
      
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
      // Use checksummed address to avoid ENS resolution
      const checksummedAddress = ethers.getAddress(recoveryForm.smartAccountAddress)
      const contract = new ethers.Contract(checksummedAddress, SmartAccountABI, signer)
      
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

  // File upload handler for proof.json
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.json')) {
      setStatus({ type: 'error', message: 'Please select a JSON file' })
      return
    }

    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string
        const recoveryPackage = JSON.parse(content)
        
        // Validate required fields for simplified format
        if (!recoveryPackage.nullifier_hash || !recoveryPackage.zk_proof) {
          throw new Error('Invalid recovery file - missing nullifier_hash or zk_proof')
        }

        // Get the guardian commitment from the smart contract
        let guardianCommitment = ''
        if (accountInfo) {
          guardianCommitment = accountInfo.guardianCommitment
        }

        // Auto-fill the form with parsed data
        setRecoveryForm(prev => ({
          ...prev,
          nullifierHash: recoveryPackage.nullifier_hash,
          zkProof: recoveryPackage.zk_proof,
          newOwnerAddress: account || '', // Use connected wallet as new owner
          guardianCommitmentForRecovery: guardianCommitment,
        }))

        setStatus({ 
          type: 'success', 
          message: `✅ Recovery file uploaded successfully! Ready to recover to your wallet (${account?.slice(0,6)}...${account?.slice(-4)})` 
        })

        console.log('Loaded recovery package:', {
          nullifier_hash: recoveryPackage.nullifier_hash,
          zk_proof: recoveryPackage.zk_proof.slice(0, 50) + '...',
          new_owner: account,
          guardian_commitment: guardianCommitment
        })

      } catch (error: any) {
        setStatus({ type: 'error', message: `Failed to read recovery file: ${error.message}` })
        console.error('File upload error:', error)
      }
    }
    
    reader.readAsText(file)
  }

  // ZK Recovery function
  const recoverAccountZK = async () => {
    if (!isConnected || !account) {
      setStatus({ type: 'error', message: 'Please connect your wallet and load account info' })
      return
    }

    if (!recoveryForm.nullifierHash || !recoveryForm.zkProof || !recoveryForm.recoveryTargetAddress) {
      setStatus({ type: 'error', message: 'Please provide nullifier hash, ZK proof, and target smart account address' })
      return
    }

    try {
      setLoading(true)
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      
      // Convert addresses to checksummed format to avoid ENS resolution
      const checksummedNewOwner = ethers.getAddress(recoveryForm.newOwnerAddress)
      const checksummedTargetAddress = ethers.getAddress(recoveryForm.recoveryTargetAddress)
      
      console.log('Using checksummed addresses:', {
        newOwner: checksummedNewOwner,
        target: checksummedTargetAddress
      })
      
      // Call ZK recover function with higher gas settings for faster execution
      const contract = new ethers.Contract(checksummedTargetAddress, SmartAccountABI, signer)
      
      // Estimate gas first, then add buffer - use checksummed addresses to avoid ENS resolution
      const estimatedGas = await contract['recoverAccount(address,uint256,bytes32,bytes)'].estimateGas(
        checksummedNewOwner,
        0,
        recoveryForm.nullifierHash,
        recoveryForm.zkProof
      )
      
      console.log('Estimated gas:', estimatedGas.toString())
      
      // Execute with optimized gas settings for Linea Sepolia
      const tx = await contract['recoverAccount(address,uint256,bytes32,bytes)'](
        checksummedNewOwner,
        0,
        recoveryForm.nullifierHash,
        recoveryForm.zkProof,
        {
          gasLimit: estimatedGas * BigInt(150) / BigInt(100), // 50% buffer for ZK verification
          maxFeePerGas: ethers.parseUnits('8', 'gwei'), // Linea Sepolia optimized gas
          maxPriorityFeePerGas: ethers.parseUnits('5', 'gwei'), // Linea Sepolia optimized priority
        }
      )
      
      console.log('Transaction sent with hash:', tx.hash)
      setStatus({ type: 'info', message: `Transaction sent! Hash: ${tx.hash}. Waiting for confirmation...` })
      
      await tx.wait()
      
      setStatus({ type: 'success', message: 'Account recovered successfully using ZK proof!' })
      // Reload account info with checksummed address
      await loadAccountInfo(checksummedTargetAddress)
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
      
      setZkProgress('Generating commitment hash...')
      
   
      
      setStatus({ 
        type: 'success', 
        message: `Guardian commitment generated: ${''}...` 
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

  return (
    <div className="container">
      <h1>Privacy Preserving Smart Account Recovery</h1>
      

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
                  {SMART_ACCOUNT_ADDRESS}
                </p>
                <button 
                  className="button" 
                  style={{ fontSize: '12px', padding: '5px 10px', marginTop: '5px' }}
                  onClick={() => {
                    setRecoveryForm(prev => ({ ...prev, smartAccountAddress: SMART_ACCOUNT_ADDRESS }))
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
          {true && (
            <div className="card">
              <h2>ZK Account Recovery</h2>
              <p>Recover this account using ZK proof data from a guardian.</p>
              
              {/* File Upload Recovery */}
              <div style={{ backgroundColor: '#f0f8ff', padding: '15px', borderRadius: '4px', margin: '15px 0' }}>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>📁 Upload Recovery File</h3>
                <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 10px 0' }}>
                  Upload the <code>proof.json</code> file from your guardian:
                </p>
                
                <div className="form-group">
                  <label className="label">Recovery Proof File:</label>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileUpload}
                    style={{ 
                      padding: '12px',
                      border: '2px dashed #e5e7eb',
                      borderRadius: '8px',
                      backgroundColor: '#f9f9f9',
                      width: '100%',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  />
                  <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                    Guardian should run: <code>npx tsx generateRecoveryHashandProof.ts</code> to generate <code>proof.json</code>
                  </p>
                </div>
              </div>

              {/* Manual Smart Account Address Input */}
              <div style={{ backgroundColor: '#fff7ed', padding: '15px', borderRadius: '4px', margin: '15px 0' }}>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>🎯 Target Smart Account</h3>
                <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 10px 0' }}>
                  Enter the smart account address you want to recover:
                </p>
                
                <div className="form-group">
                  <label className="label">Smart Account Address to Recover:</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="0x..."
                    value={recoveryForm.recoveryTargetAddress}
                    onChange={(e) => setRecoveryForm(prev => ({ ...prev, recoveryTargetAddress: e.target.value }))}
                    style={{ 
                      fontFamily: 'monospace',
                      fontSize: '14px'
                    }}
                  />
                  <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                    This is the smart account you want to recover ownership of using ZK proof
                  </p>
                </div>
              </div>

              {/* Show Recovery Details after file upload */}
              {recoveryForm.nullifierHash && (
                <div style={{ backgroundColor: '#f0fdf4', padding: '15px', borderRadius: '4px', margin: '15px 0' }}>
                  <h3 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>✅ Recovery Details Loaded</h3>
                  
                  <div className="form-group">
                    <label className="label">New Owner Address (You):</label>
                    <input
                      type="text"
                      className="input"
                      value={recoveryForm.newOwnerAddress || account || 'Connect wallet first...'}
                      readOnly
                      style={{ 
                        backgroundColor: '#f9f9f9', 
                        cursor: 'not-allowed',
                        color: '#4b5563'
                      }}
                    />
                    <p style={{ fontSize: '12px', color: '#10b981', marginTop: '4px' }}>
                      ✅ This is automatically set to your connected wallet address. You will become the new owner.
                    </p>
                  </div>
                  
                  <div className="form-group">
                    <label className="label">Nullifier Hash:</label>
                    <input
                      type="text"
                      className="input"
                      value={recoveryForm.nullifierHash}
                      readOnly
                      style={{ 
                        backgroundColor: '#f9f9f9', 
                        cursor: 'not-allowed',
                        color: '#4b5563',
                        fontFamily: 'monospace',
                        fontSize: '12px'
                      }}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label className="label">ZK Proof:</label>
                    <input
                      type="text"
                      className="input"
                      value={recoveryForm.zkProof ? `${recoveryForm.zkProof.slice(0, 50)}...` : ''}
                      readOnly
                      style={{ 
                        backgroundColor: '#f9f9f9', 
                        cursor: 'not-allowed',
                        color: '#4b5563',
                        fontFamily: 'monospace',
                        fontSize: '12px'
                      }}
                    />
                    <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                      ZK proof loaded ({recoveryForm.zkProof ? Math.floor(recoveryForm.zkProof.length / 2) : 0} bytes)
                    </p>
                  </div>
                </div>
              )}


              {/* Submit Recovery */}
              <button
                className="button"
                onClick={recoverAccountZK}
                disabled={loading || !recoveryForm.newOwnerAddress || !recoveryForm.nullifierHash || !recoveryForm.zkProof || !recoveryForm.recoveryTargetAddress}
                style={{ backgroundColor: '#dc2626', color: 'white', fontSize: '16px', padding: '12px 24px' }}
              >
                {loading ? 'Recovering Account...' : '🔓 Execute ZK Recovery (High Gas)'}
              </button>
              
              <p style={{ fontSize: '12px', color: '#dc2626', marginTop: '8px', fontWeight: '500' }}>
                ⚠️ This will transfer ownership of {recoveryForm.recoveryTargetAddress ? `${recoveryForm.recoveryTargetAddress.slice(0,6)}...${recoveryForm.recoveryTargetAddress.slice(-4)}` : 'the target smart account'} to your connected wallet ({account ? `${account.slice(0,6)}...${account.slice(-4)}` : 'your address'}). Make sure all details are correct!
              </p>
            </div>
          )}

    
        </>
      )}

      {/* Status Messages */}
      {status && (
        <div className={`status-box status-${status.type}`}>
          {status.message}
          {status.message && status.message.includes('circuit breaker') && (
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