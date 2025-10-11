'use client'

import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import { SmartAccountABI } from './abis/SmartAccount'

// Contract addresses from deployment
const SMART_ACCOUNT_ADDRESS = '0xa16E02E87b7454126E5E10d957A927A7F5B5d2be' // Replace with actual address

interface AccountInfo {
  address: string
  owner: string
  guardian: string
  nonce: number
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
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<{ type: 'info' | 'success' | 'error', message: string } | null>(null)
  const [recoveryForm, setRecoveryForm] = useState({
    smartAccountAddress: '',
    newOwnerAddress: '',
    guardianAddress: '',
  })

  // Connect wallet
  const connectWallet = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
        setAccount(accounts[0])
        setIsConnected(true)
        setStatus({ type: 'success', message: 'Wallet connected successfully' })
      } catch (error) {
        console.error('Error connecting wallet:', error)
        setStatus({ type: 'error', message: 'Failed to connect wallet' })
      }
    } else {
      setStatus({ type: 'error', message: 'Please install MetaMask' })
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
            <button className="button button-secondary" onClick={() => setIsConnected(false)}>
              Disconnect
            </button>
          </div>
        )}
      </div>

      {isConnected && (
        <>
          {/* Load Account Info */}
          <div className="card">
            <h2>Load Smart Account Information</h2>
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
              </div>
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
              <h2>Information</h2>
              <p>You are not the owner or guardian of this account. You can view the information but cannot perform any actions.</p>
            </div>
          )}
        </>
      )}

      {/* Status Messages */}
      {status && (
        <div className={`status-box status-${status.type}`}>
          {status.message}
        </div>
      )}
    </div>
  )
}