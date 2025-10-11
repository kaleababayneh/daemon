import { http, createConfig } from 'wagmi'
import { localhost } from 'wagmi/chains'
import { injected, metaMask } from 'wagmi/connectors'

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