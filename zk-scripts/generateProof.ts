import { Noir } from "@noir-lang/noir_js";
import { ethers } from "ethers";
import { UltraHonkBackend, Barretenberg, Fr } from "@aztec/bb.js";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import generateCommitment, { englishWordToField } from "./generateCommitment.js";

/**
 * Generate a proper Poseidon2 commitment hash using Barretenberg
 * This matches the circuit's Poseidon2 implementation exactly
 */
async function generatePoseidon2Hash(inputs: Fr[]): Promise<string> {
    try {
        const bb = await Barretenberg.new();
        
        // Use Barretenberg's Poseidon2 implementation to match the circuit
        const hash = await bb.poseidon2Hash(inputs);
        
        await bb.destroy();
        
        // Convert to hex string
        const hashString = hash.toString();
        return `0x${BigInt(hashString).toString(16).padStart(64, '0')}`;
    } catch (error) {
        console.error('Error generating Poseidon2 hash:', error);
        throw error;
    }
}

// Get current directory in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load circuit (go up one directory from scripts to project root)
const projectRoot = path.join(__dirname, '..');
const circuit_path = path.join(projectRoot, "circuits/target/circuits.json");

const circuit = JSON.parse(fs.readFileSync(circuit_path, "utf-8"));

export default async function generateProof(
    currentOwner?: string, 
    newOwner?: string
): Promise<{ proof: Uint8Array; nullifierHash: string; commitment: string }> {
    try {
        const noir = new Noir(circuit);
        
        const bb = new UltraHonkBackend(
            circuit.bytecode,
            { threads: 1 }
        );

        // Use passed parameters or default test values
        const secret_key = new Fr(1n);  // Simple value as Fr
        const secret_answer = new Fr(2n);  // Single secret answer as Fr
        
        // Use dynamic owner values or defaults
        const current_owner = currentOwner || "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";
        const new_owner = newOwner || "0x70997970c51812dc3a010c7d01b50e0d17dc79c8";
        
        // Convert addresses exactly like the contract: bytes32(uint256(uint160(address)))
        const currentOwnerConverted = `0x000000000000000000000000${current_owner.slice(2).toLowerCase()}`;
        const newOwnerConverted = `0x000000000000000000000000${new_owner.slice(2).toLowerCase()}`;
        
        // Convert addresses to Fr for hashing
        const newOwnerFr = new Fr(BigInt(newOwnerConverted));
        const currentOwnerFr = new Fr(BigInt(currentOwnerConverted));

        console.log("Computing Poseidon2 hashes using Barretenberg...");
        
        // Compute commitment = Poseidon2::hash([secret_key, secret_answer], 2)
        const commitment = await generatePoseidon2Hash([secret_key, secret_answer]);
        console.log("Computed commitment:", commitment);
        
        // Compute nullifier_hash = Poseidon2::hash([secret_key, Poseidon2::hash([secret_answer], 1), new_owner, current_owner], 4)
        const hashedSecretAnswer = await generatePoseidon2Hash([secret_answer]);
        const nullifier_hash = await generatePoseidon2Hash([secret_key, new Fr(BigInt(hashedSecretAnswer)), newOwnerFr, currentOwnerFr]);
        console.log("Computed nullifier_hash:", nullifier_hash);

        console.log("Using computed values:");
        console.log("secret_key:", secret_key.toString());
        console.log("secret_answer:", secret_answer.toString());
        console.log("new_owner:", newOwnerConverted);
        console.log("current_owner:", currentOwnerConverted);

        const inputs = {
            nullifier_hash: nullifier_hash,
            guardians_commitment: commitment,
            new_owner: newOwnerConverted,
            current_owner: currentOwnerConverted,
            secret_answer: secret_answer.toString(),
            secret_key: secret_key.toString(),
        }

        const { witness } = await noir.execute(inputs);

        const proofData = await bb.generateProof(witness, {
            keccak: true,
        });

        console.log("Proof generated successfully");
        console.log("Original proof length:", proofData.proof.length);
        console.log("Expected length:", 440 * 32);
        console.log("Difference:", proofData.proof.length - (440 * 32));
        
        // Verify the proof with the same format that was generated
        const verification = await bb.verifyProof(proofData);
        console.log("Proof verification result:", verification);
        console.log("Public inputs:", proofData.publicInputs);
        
        await bb.destroy();
        return { 
            proof: proofData.proof, 
            nullifierHash: nullifier_hash,
            commitment: commitment
        };
    } catch (error) {
        console.error("Error generating proof:", error);
        throw error;
    }
}


(async () => {
    generateProof().then((result) => {
        console.log("Proof:", result);
        // Optionally save the proof to file like the working example
        fs.writeFileSync(path.join(projectRoot, "circuits/target/proof"), result.proof);
        console.log("Proof saved to circuits/target/proof");
    }).catch((error) => {
        console.error("Error in generateProof:", error);
    });
})();