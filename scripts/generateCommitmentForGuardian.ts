/**
 * Guardian Helper Script 1: Generate Commitment Hash
 * 
 * This script helps guardians generate a commitment hash that they will
 * provide to the account owner to set as the guardian commitment.
 * 
 * The commitment is calculated as:
 * commitment = Poseidon2.hash([secret_key, secret_answer])
 * 
 * Usage: npx hardhat run scripts/generateCommitmentForGuardian.ts
 */

import { BarretenbergBackend } from '@noir-lang/backend_barretenberg';
import { Noir } from '@noir-lang/noir_js';
import circuit from '../circuits/target/circuits.json';
import { ethers } from 'hardhat';

async function main() {
    console.log('🛡️ Guardian Commitment Generator');
    console.log('==================================');
    
    // Initialize Noir circuit
    const backend = new BarretenbergBackend(circuit);
    const noir = new Noir(circuit, backend);
    
    // Guardian's secret values (in a real scenario, these would be input by the guardian)
    const SECRET_KEY = "0x0000000000000000000000000000000000000000000000000000000000000001";
    const SECRET_ANSWER = "0x0000000000000000000000000000000000000000000000000000000000000002";
    
    console.log('📝 Guardian Secret Configuration:');
    console.log(`Secret Key: ${SECRET_KEY}`);
    console.log(`Secret Answer: ${SECRET_ANSWER}`);
    console.log('');
    
    // Prepare inputs for commitment generation
    const inputs = {
        secret_key: SECRET_KEY,
        secret_answer: SECRET_ANSWER,
        new_owner: "0x0000000000000000000000000000000000000000000000000000000000000000", // dummy for commitment
        current_owner: "0x0000000000000000000000000000000000000000000000000000000000000000" // dummy for commitment
    };
    
    try {
        console.log('🧮 Computing Poseidon2 hashes using Barretenberg...');
        
        // Generate proof to get the commitment
        const { witness } = await noir.execute(inputs);
        const proof = await backend.generateProof(witness);
        const publicInputs = proof.publicInputs;
        
        // The commitment is the second public input (index 1)
        const commitment = publicInputs[1];
        
        console.log('✨ Guardian Commitment Generated!');
        console.log('==================================');
        console.log(`Commitment Hash: ${commitment}`);
        console.log('');
        console.log('📋 Instructions for Guardian:');
        console.log('1. Save your secret values securely:');
        console.log(`   - Secret Key: ${SECRET_KEY}`);
        console.log(`   - Secret Answer: ${SECRET_ANSWER}`);
        console.log('');
        console.log('2. Provide this commitment hash to the account owner:');
        console.log(`   ${commitment}`);
        console.log('');
        console.log('3. The account owner will use this hash to set you as guardian');
        console.log('4. Keep your secrets safe - you\'ll need them for recovery!');
        console.log('');
        console.log('⚠️  SECURITY NOTE:');
        console.log('   - Never share your secret key or secret answer');
        console.log('   - Only share the commitment hash with the account owner');
        console.log('   - Store your secrets in a secure password manager');
        
        return {
            commitment,
            secretKey: SECRET_KEY,
            secretAnswer: SECRET_ANSWER
        };
        
    } catch (error) {
        console.error('❌ Error generating commitment:', error);
        throw error;
    }
}

// Export for use in other scripts
export default main;

// Run if called directly
if (require.main === module) {
    main().catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
}