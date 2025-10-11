'use client';

import { UltraHonkBackend, Barretenberg, Fr } from "@aztec/bb.js";
import { ethers } from "ethers";

// Import the circuit JSON from the circuits folder
// This matches the working zk-scripts implementation
const CIRCUIT_URL = '/circuits.json';

// Dynamic imports for client-side only
let Noir: any = null;

async function loadNoir() {
    if (typeof window !== 'undefined' && !Noir) {
        const { Noir: NoirImport } = await import('@noir-lang/noir_js');
        Noir = NoirImport;
    }
    return Noir;
}

/**
 * Generate Poseidon2 hash using Barretenberg
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

/**
 * Convert Uint8Array to hex string
 */
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

/**
 * Generate Guardian Commitment Hash
 */
export async function generateCommitmentHash(
    secretKey: string, 
    secretAnswer: string
): Promise<string> {
    try {
        const secretKeyFr = new Fr(BigInt(secretKey));
        const secretAnswerFr = new Fr(BigInt(secretAnswer));
        
        return await generatePoseidon2Hash([secretKeyFr, secretAnswerFr]);
    } catch (error) {
        console.error('Error generating commitment hash:', error);
        throw error;
    }
}

/**
 * Generate Recovery Proof
 */
export async function generateRecoveryProof(
    secretKey: string,
    secretAnswer: string,
    currentOwner: string,
    newOwner: string,
    onProgress?: (message: string) => void
): Promise<{
    nullifierHash: string;
    zkProof: string;
    commitment: string;
    isValid: boolean;
}> {
    try {
        // Check if we're in the browser
        if (typeof window === 'undefined') {
            throw new Error('ZK proof generation is only available in the browser');
        }

        onProgress?.('Loading circuit...');
        
        // Load Noir dynamically
        const NoirClass = await loadNoir();
        if (!NoirClass) {
            throw new Error('Failed to load Noir');
        }
        
        // Fetch the circuit JSON
        const response = await fetch(CIRCUIT_URL);
        if (!response.ok) {
            throw new Error('Failed to load circuit. Make sure circuits.json is in the public folder.');
        }
        const circuit = await response.json();
        
        onProgress?.('Initializing proof system...');
        
        const noir = new NoirClass(circuit);
        const backend = new UltraHonkBackend(circuit.bytecode, { threads: 1 });
        
        onProgress?.('Computing hashes...');
        
        // Convert to field elements
        const secretKeyFr = new Fr(BigInt(secretKey));
        const secretAnswerFr = new Fr(BigInt(secretAnswer));
        
        // Convert addresses to bytes32
        const currentOwnerBytes32 = ethers.zeroPadValue(currentOwner, 32);
        const newOwnerBytes32 = ethers.zeroPadValue(newOwner, 32);
        
        // Generate commitment
        const commitment = await generatePoseidon2Hash([secretKeyFr, secretAnswerFr]);
        
        // Generate nullifier hash
        const currentOwnerFr = new Fr(BigInt(currentOwnerBytes32));
        const newOwnerFr = new Fr(BigInt(newOwnerBytes32));
        const nullifierHash = await generatePoseidon2Hash([secretKeyFr, newOwnerFr, currentOwnerFr]);
        
        onProgress?.('Generating witness...');
        
        const inputs = {
            secret_key: secretKey,
            secret_answer: secretAnswer,
            new_owner: newOwnerBytes32,
            current_owner: currentOwnerBytes32
        };
        
        const { witness } = await noir.execute(inputs);
        
        onProgress?.('Generating proof...');
        
        const { proof, publicInputs } = await backend.generateProof(witness);
        
        onProgress?.('Verifying proof...');
        
        const isValid = await backend.verifyProof({ proof, publicInputs });
        
        const zkProof = uint8ArrayToHex(proof);
        
        onProgress?.('Proof generation complete!');
        
        return {
            nullifierHash,
            zkProof,
            commitment,
            isValid
        };
        
    } catch (error) {
        console.error('Error generating recovery proof:', error);
        throw error;
    }
}

/**
 * Verify if a commitment hash matches the secret values
 */
export async function verifyCommitment(
    secretKey: string,
    secretAnswer: string,
    expectedCommitment: string
): Promise<boolean> {
    try {
        const computedCommitment = await generateCommitmentHash(secretKey, secretAnswer);
        return computedCommitment.toLowerCase() === expectedCommitment.toLowerCase();
    } catch (error) {
        console.error('Error verifying commitment:', error);
        return false;
    }
}