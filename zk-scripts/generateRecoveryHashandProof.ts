import { Barretenberg, Fr } from "@aztec/bb.js";
import { ethers } from "ethers";
import { Noir } from "@noir-lang/noir_js";
import { UltraHonkBackend } from "@aztec/bb.js";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const FIELD_MODULUS = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

export function englishWordToField(word: string): Fr {
    let binaryString = "";
    for (let i = 0; i < word.length; i++) {
        binaryString += word.charCodeAt(i).toString(2).padStart(8, "0");
    }
    const wordBigInt = BigInt("0b" + binaryString);
    return new Fr(wordBigInt);
}

export function uint8ArrayToHex(buffer: Uint8Array): string {
    const hex: string[] = [];
    buffer.forEach(function (i) {
        let h = i.toString(16);
        if (h.length % 2) {
            h = "0" + h;
        }
        hex.push(h);
    });
    return hex.join("");
}

async function generatePoseidon2Hash(inputs: Fr[]): Promise<string> {
    const bb = await Barretenberg.new();
    const hash = await bb.poseidon2Hash(inputs);
    await bb.destroy();
    const hashString = hash.toString();
    return `0x${BigInt(hashString).toString(16).padStart(64, '0')}`;
}

// Get circuit path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');
const circuit_path = path.join(projectRoot, "circuits/target/circuits.json");

export default async function generateRecoveryProof(
    currentOwner: string = "0x945dc407f256015329D5E38BE8367278a4ab072c", // Will be updated for Base Sepolia
    newOwner: string = "0x3749E100946fde968aA4c9BF0f43f5FD0D312aDa"     // New owner (can be changed)
): Promise<{
    proof: Uint8Array;
    nullifierHash: string;
    commitment: string;
    publicInputs: string[];
}> {
    console.log("🔐 ZK Recovery Proof Generation");
    
    // Load circuit
    const circuit = JSON.parse(fs.readFileSync(circuit_path, "utf-8"));
    const noir = new Noir(circuit);
    const bb = new UltraHonkBackend(circuit.bytecode, { threads: 1 });

    // Circuit inputs matching your specification
    const secret_key = Fr.fromString((0xdf57089febbacf7ba0bc227dafbffa9fc08a93fdc68e1e42411a14efcf23656en % FIELD_MODULUS).toString());
    const secret_answer = englishWordToField("mango");
    
    console.log("📋 Configuration:");
    console.log(`   Current Owner: ${currentOwner}`);
    console.log(`   New Owner: ${newOwner}`);
    console.log("");
    
    // Convert addresses exactly like the contract
    const currentOwnerConverted = `0x000000000000000000000000${currentOwner.slice(2).toLowerCase()}`;
    const newOwnerConverted = `0x000000000000000000000000${newOwner.slice(2).toLowerCase()}`;
    
    const newOwnerFr = new Fr(BigInt(newOwnerConverted));
    const currentOwnerFr = new Fr(BigInt(currentOwnerConverted));

    // Generate commitment and nullifier hash
    const guardians_commitment = await generatePoseidon2Hash([secret_key, secret_answer]);
    const hashedSecretAnswer = await generatePoseidon2Hash([secret_answer]);
    const nullifier_hash = await generatePoseidon2Hash([secret_key, new Fr(BigInt(hashedSecretAnswer)), newOwnerFr, currentOwnerFr]);

    console.log("🧮 Circuit Inputs:");
    console.log(`   nullifier_hash: ${nullifier_hash}`);
    console.log(`   guardians_commitment: ${guardians_commitment}`);
    console.log("");

    // Prepare circuit inputs
    const inputs = {
        nullifier_hash: nullifier_hash,
        guardians_commitment: guardians_commitment,
        new_owner: newOwnerConverted,
        current_owner: currentOwnerConverted,
        secret_answer: secret_answer.toString(),
        secret_key: secret_key.toString(),
    };

    console.log("⚙️ Generating witness...");
    const { witness } = await noir.execute(inputs);

    console.log("� Generating ZK proof...");
    const proofData = await bb.generateProof(witness, { keccak: true });

    console.log("✅ Proof generated successfully!");
    console.log(`   Proof length: ${proofData.proof.length} bytes`);
    console.log(`   Public inputs: ${proofData.publicInputs.length} values`);
    console.log("");

    // Verify the proof
    console.log("🔍 Verifying proof...");
    
    console.log("");

    console.log("📦 Generated Proof Data:");
    console.log("========================");
   

    await bb.destroy();

    return {
        proof: proofData.proof,
        nullifierHash: nullifier_hash,
        commitment: guardians_commitment,
        publicInputs: proofData.publicInputs
    };
}


(
    async () => {
        try {
            const result = await generateRecoveryProof();
            
            // Create simplified recovery data package
            const recoveryPackage = {
                nullifier_hash: result.nullifierHash,
                zk_proof: `0x${uint8ArrayToHex(result.proof)}`
            };

            // Save to proof.json file
            const outputPath = path.join(__dirname, 'proof.json');
            fs.writeFileSync(outputPath, JSON.stringify(recoveryPackage, null, 2));
            
            console.log("🎉 Recovery proof generation complete!");
            console.log("======================================");
            console.log(`📋 Summary:`);
            console.log(`   Nullifier Hash: ${result.nullifierHash}`);
            console.log(`   Commitment: ${result.commitment}`);
            console.log(`   Proof length: ${result.proof.length} bytes`);
            console.log("");
            console.log(`📁 Recovery file saved to: ${outputPath}`);
            console.log("📤 Share this proof.json file with the user who wants to recover the account");
            
            process.exit(0);
        } catch (error: any) {
            console.error("❌ Error generating recovery proof:", error);
            process.exit(1);
        }
    }
)();