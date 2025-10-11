import { UltraHonkBackend, Barretenberg, Fr } from "@aztec/bb.js";
import { ethers } from "ethers";
import * as readline from 'readline';
// @ts-ignore
import { Noir } from "@noir-lang/noir_js";
import circuit from "../circuits/target/circuits.json";
import { CompiledCircuit } from '@noir-lang/types';

/**
 * Generate Recovery Proof for Guardian
 * Based on the working zk-scripts implementation
 * This script helps guardians generate nullifier hash and ZK proof for account recovery
 */

async function generatePoseidon2Hash(inputs: Fr[]): Promise<string> {
    try {
        const bb = await Barretenberg.new();
        const hash = await bb.poseidon2Hash(inputs);
        await bb.destroy();
        
        const hashString = hash.toString();
        return `0x${BigInt(hashString).toString(16).padStart(64, '0')}`;
    } catch (error) {
        console.error('Error generating Poseidon2 hash:', error);
        throw error;
    }
}

async function promptUser(question: string): Promise<string> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

function uint8ArrayToHex(buffer: Uint8Array): string {
    const hex: string[] = [];
    buffer.forEach(function (i) {
        let h = i.toString(16);
        if (h.length % 2) {
            h = "0" + h;
        }
        hex.push(h);
    });
    return `0x${hex.join("")}`;
}

async function main() {
    console.log('\n🔐 Guardian Recovery Proof Generator');
    console.log('====================================\n');
    
    console.log('This script helps guardians generate ZK proofs for account recovery.');
    console.log('You will need your secret key and answer that were used to generate the commitment.\n');
    
    // Get inputs from guardian
    const secretKey = await promptUser('Enter your secret key: ');
    const secretAnswer = await promptUser('Enter your secret answer: ');
    const currentOwner = await promptUser('Enter current account owner address: ');
    const newOwner = await promptUser('Enter new owner address (who should get the account): ');
    
    if (!secretKey || !secretAnswer || !currentOwner || !newOwner) {
        console.error('❌ All fields are required');
        process.exit(1);
    }
    
    // Validate addresses
    if (!ethers.isAddress(currentOwner) || !ethers.isAddress(newOwner)) {
        console.error('❌ Invalid Ethereum addresses provided');
        process.exit(1);
    }
    
    try {
        console.log('\n🔄 Computing hashes and generating proof...');
        
        // Convert to field elements
        const secretKeyFr = new Fr(BigInt(secretKey));
        const secretAnswerFr = new Fr(BigInt(secretAnswer));
        
        // Convert addresses to bytes32 (same as in contract)
        const currentOwnerBytes32 = ethers.zeroPadValue(currentOwner, 32);
        const newOwnerBytes32 = ethers.zeroPadValue(newOwner, 32);
        
        // Generate commitment hash
        const commitment = await generatePoseidon2Hash([secretKeyFr, secretAnswerFr]);
        console.log(`✅ Commitment hash: ${commitment}`);
        
        // Generate nullifier hash: Poseidon2.hash([secret_key, new_owner, current_owner])
        const currentOwnerFr = new Fr(BigInt(currentOwnerBytes32));
        const newOwnerFr = new Fr(BigInt(newOwnerBytes32));
        const nullifierHash = await generatePoseidon2Hash([secretKeyFr, newOwnerFr, currentOwnerFr]);
        console.log(`✅ Nullifier hash: ${nullifierHash}`);
        
        // Generate ZK proof
        console.log('\n🔄 Generating ZK proof...');
        
        const noir = new Noir(circuit as CompiledCircuit);
        const backend = new UltraHonkBackend(circuit.bytecode, { threads: 1 });
        
        const inputs = {
            secret_key: secretKey,
            secret_answer: secretAnswer,
            new_owner: newOwnerBytes32,
            current_owner: currentOwnerBytes32
        };
        
        console.log('Generating witness...');
        const { witness } = await noir.execute(inputs);
        
        console.log('Generating proof...');
        const { proof, publicInputs } = await backend.generateProof(witness);
        
        console.log('Verifying proof...');
        const isValid = await backend.verifyProof({ proof, publicInputs });
        
        const zkProof = uint8ArrayToHex(proof);
        
        console.log('\n✅ Recovery Proof Generated Successfully!');
        console.log('========================================');
        console.log(`🔒 Nullifier Hash: ${nullifierHash}`);
        console.log(`🔐 ZK Proof: ${zkProof}`);
        console.log(`✅ Proof Valid: ${isValid}`);
        console.log(`📋 Public Inputs: ${JSON.stringify(publicInputs)}`);
        
        console.log('\n📋 Instructions for Account Recovery:');
        console.log('1. Give the Nullifier Hash and ZK Proof to the person recovering the account');
        console.log('2. They should use these in the frontend\'s ZK Recovery section');
        console.log('3. Set the "New Owner Address" to the address you specified');
        
        // Save to file
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `recovery-proof-${timestamp}.json`;
        
        const recoveryData = {
            timestamp: new Date().toISOString(),
            currentOwner,
            newOwner,
            nullifierHash,
            zkProof,
            isValid,
            publicInputs,
            instructions: 'Use nullifierHash and zkProof in the frontend ZK Recovery section'
        };
        
        const fs = await import('fs');
        fs.writeFileSync(filename, JSON.stringify(recoveryData, null, 2));
        console.log(`\n💾 Recovery data saved to: ${filename}`);
        
    } catch (error) {
        console.error('❌ Error generating recovery proof:', error);
        console.error(error);
        process.exit(1);
    }
}

main().catch(console.error);