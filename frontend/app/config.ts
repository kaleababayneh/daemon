import { http, createConfig } from 'wagmi'
import { localhost } from 'wagmi/chains'
import { injected, metaMask } from 'wagmi/connectors'

export const LINEA_TESTNET = {
  chainId: 59141, // Linea Sepolia testnet
  rpcUrl: 'https://rpc.sepolia.linea.build/',
  blockExplorer: 'https://sepolia.lineascan.build/'
}

export const config = createConfig({
  chains: [localhost],
  connectors: [
    injected(),
    metaMask(),
  ],
  transports: {
    [localhost.id]: http('http://localhost:8545'),
  },
})

export const getContractAddresses = (chainId: number) => {
  switch(chainId) {
    case 31337: // localhost
      return { /* your current addresses */ }
    case 59140: // Linea testnet  
      return { /* deployed testnet addresses */ }
    default:
      throw new Error(`Unsupported chain: ${chainId}`)
  }
}