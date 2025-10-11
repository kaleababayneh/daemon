import { Barretenberg, Fr } from "@aztec/bb.js";
import generateCommitment, { englishWordToField } from "./generateCommitment.js";

const FIELD_MODULUS = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

async function debugProofInputs() {
    const bb = await Barretenberg.new();

    // Same values as in generateProof.ts
    const secret_key = Fr.fromString((0xdf57089febbacf7ba0bc227dafbffa9fc08a93fdc68e1e42411a14efcf23656en % FIELD_MODULUS).toString());
    const secret_answer_one = englishWordToField("apple");
    const secret_answer_two = englishWordToField("dog");
    const current_owner = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";
    const new_owner = "0x70997970c51812dc3a010c7d01b50e0d17dc79c8";
    
    // Convert addresses exactly like the contract
    const newOwnerConverted = `0x${new_owner.slice(2).padStart(64, '0')}`;
    const currentOwnerConverted = `0x${current_owner.slice(2).padStart(64, '0')}`;

    const nullifier_hash = await bb.poseidon2Hash([secret_key, secret_answer_two, Fr.fromString(newOwnerConverted), Fr.fromString(currentOwnerConverted)]);
    const commitment = await generateCommitment();

    console.log("=== PROOF GENERATION VALUES ===");
    console.log("nullifier_hash:", nullifier_hash.toString());
    console.log("guardians_commitment:", commitment.toString());
    console.log("new_owner (converted):", newOwnerConverted);
    console.log("current_owner (converted):", currentOwnerConverted);

    console.log("\n=== CONTRACT EXPECTED VALUES ===");
    console.log("publicInputs[0] (nullifierHash): 0x2cd4d71448af6e33f360c4413015a6c5029ec64d4caaaee246602769d1760eaa");
    console.log("publicInputs[1] (guardianCommitments): 0x01ed2748ac88efdb33f8b6ebf525601961ced4ee001e0f21577178d7b368bc8f");
    console.log("publicInputs[2] (newOwner): 0x00000000000000000000000070997970c51812dc3a010c7d01b50e0d17dc79c8");
    console.log("publicInputs[3] (currentOwner): 0x000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cfffb92266");

    console.log("\n=== COMPARISON ===");
    console.log("Nullifier match:", nullifier_hash.toString() === "0x2cd4d71448af6e33f360c4413015a6c5029ec64d4caaaee246602769d1760eaa");
    console.log("Commitment match:", commitment.toString() === "0x01ed2748ac88efdb33f8b6ebf525601961ced4ee001e0f21577178d7b368bc8f");
    console.log("New owner match:", newOwnerConverted === "0x00000000000000000000000070997970c51812dc3a010c7d01b50e0d17dc79c8");
    console.log("Current owner match:", currentOwnerConverted === "0x000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cfffb92266");

    bb.destroy();
}

debugProofInputs().catch(console.error);