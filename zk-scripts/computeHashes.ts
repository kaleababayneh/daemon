import { createHash } from 'crypto';
import poseidon from 'poseidon-lite';

// Simple function to convert a string to a field element
function toField(value: string): string {
    // For simple numeric strings, just return as is
    if (/^\d+$/.test(value)) {
        return value;
    }
    
    // For hex strings, convert to decimal
    if (value.startsWith('0x')) {
        return BigInt(value).toString();
    }
    
    // For other strings, hash them first
    const hash = createHash('sha256').update(value).digest('hex');
    return BigInt('0x' + hash).toString();
}

async function computeCorrectHashes() {
    // Using simple test values
    const secret_key = "1";
    const secret_answer_one = "2"; 
    const secret_answer_two = "3";
    const current_owner = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";
    const new_owner = "0x70997970c51812dc3a010c7d01b50e0d17dc79c8";
    
    // Convert addresses exactly like the contract: bytes32(uint256(uint160(address)))
    const currentOwnerConverted = "0x000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cfffb92266";
    const newOwnerConverted = "0x00000000000000000000000070997970c51812dc3a010c7d01b50e0d17dc79c8";

    console.log("Computing with values:");
    console.log("secret_key:", secret_key);
    console.log("secret_answer_one:", secret_answer_one);
    console.log("secret_answer_two:", secret_answer_two);
    console.log("new_owner:", newOwnerConverted);
    console.log("current_owner:", currentOwnerConverted);

    // Compute commitment = Poseidon2::hash([secret_key, secret_answer_one], 2)
    // Note: poseidon-lite might use different constants than Noir's Poseidon2
    // We'll need to use the actual Noir/Aztec Poseidon implementation
    
    console.log("\nWe need to use the exact same Poseidon2 implementation as Noir...");
    console.log("The issue is that different Poseidon implementations use different constants.");
    console.log("\nSolution: Let's modify the circuit to output the computed values!");
}

computeCorrectHashes().catch(console.error);