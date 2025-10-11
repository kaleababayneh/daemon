#!/bin/bash

# Script to get the deployed Smart Account address
# Run this after deploying your contracts

echo "🔍 Finding deployed Smart Account address..."

# Method 1: If you have the factory address and know the nonce
FACTORY_ADDR="0x5fbdb2315678afecb367f032d93f642f64180aa3"
FACTORY_NONCE=1

echo "Factory Address: $FACTORY_ADDR"
echo "Factory Nonce: $FACTORY_NONCE"

# Method 2: Use ethers to calculate the address
node -e "
const { getCreateAddress } = require('ethers');
const address = getCreateAddress({
  from: '$FACTORY_ADDR',
  nonce: $FACTORY_NONCE
});
console.log('Calculated Smart Account Address:', address);
"

echo ""
echo "📝 Update the address in frontend/app/page.tsx:"
echo "const SMART_ACCOUNT_ADDRESS = 'CALCULATED_ADDRESS_ABOVE'"