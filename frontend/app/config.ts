// Linea Sepolia Network Configuration
export const LINEA_SEPOLIA = {
  chainId: 59141,
  chainIdHex: '0xe705',
  name: 'Linea Sepolia',
  rpcUrl: 'https://rpc.sepolia.linea.build',
  blockExplorer: 'https://sepolia.lineascan.build',
  nativeCurrency: {
    name: 'Ethereum',
    symbol: 'ETH',
    decimals: 18,
  },
}

// Contract Addresses for Linea Sepolia
export const CONTRACT_ADDRESSES = {
  poseidon2: '0xb92036C1E795FA54b13E7679c805915b43c7F089',
  honkVerifier: '0xBf20D4bB442C725f9cBFA30Fb19633ae812A219F',
  entryPoint: '0x501Fe10135Ad30BC6FD25Dbb63F54D98409a1DfC',
  smartAccountFactory: '0x0Ffe1bf8dD812e111c20469C433a20903ACcc4a7',
  erc20Mock: '0xf728e95F5aeEd3DA887ff82F48911BAE263BB0C5',
  smartAccount: '0xeAedBDD949FD14CE86fA9B16D833075e0c3D2DfF' // Updated with actual deployed address
}

export const getContractAddresses = (chainId: number) => {
    return CONTRACT_ADDRESSES
}