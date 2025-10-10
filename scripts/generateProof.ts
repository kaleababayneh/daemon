import { Barretenberg, Fr, UltraHonkBackend } from "@aztec/bb.js";
import { ethers } from "ethers";
import { Noir } from "@noir-lang/noir_js";
import fs from "fs";
import path from "path";

const circuit = JSON.parse(
    fs.readFileSync(
        path.resolve(__dirname, "../../circuits/target/circuits.json"),
        "utf-8"
    )
);

export default async function generateProof(): Promise<any> {
    const inputs = process.argv.slice(2);
    const bb = await Barretenberg.new();

    const nullifier = inputs[0];
    const secret = inputs[1];
    const recipient = inputs[2];
    const leaves = inputs.slice(3);
   
    const commitment = await bb.poseidon2Hash([Fr.fromString(nullifier), Fr.fromString(secret)]);


    const nullifier_hash = await bb.poseidon2Hash([Fr.fromString(nullifier)]);
    const merkleProof = tree.proof(tree.getIndex(commitment.toString()));
    
    try{
       
        const noir = new Noir(circuit);
        const honk = new UltraHonkBackend(circuit.bytecode, {
            threads: 1,
        });

      
        /**
          // public inputs
            nullifier_hash: pub Field,
            guardians_commitment: pub [Field; 5],
            new_owner: pub Field,       
            current_owner: pub Field,   
            // private inputs
            secret_answer_one: Field,
            secret_answer_two: Field,
            secret_key: Field,
         */
        const input = {
            root: tree.root().toString(),
            nullifier_hash: nullifier_hash.toString(),
            recipient: recipient,
            nullifier: nullifier,
            secret: secret,
            merkle_proof: merkleProof.pathElements.map((el) => el.toString()),
            is_even: merkleProof.pathIndices.map((el) => (el % 2 === 0 ? true : false)),

        }

        const { witness } = await noir.execute(input);
        const originalLog = console.log;
        console.log = function() {};
        const { proof } = await honk.generateProof(witness, {
            keccak: true,
        });
        console.log = originalLog;
        
        // Create public inputs array
        const publicInputs = [
            tree.root(),
            nullifier_hash.toString(),
            recipient
        ];
        
        const result = ethers.AbiCoder.defaultAbiCoder().encode(
            ["bytes", "bytes32[]"],
            [proof, publicInputs]
        );

        return result;
    } catch (error) {
        console.error("Error generating proof:", error);
        throw error;
    }
}


(
    async () => {
        generateProof().then((result) => {
           process.stdout.write(result);
           process.exit(0);
        }).catch((error) => {
            console.error(error);
            process.exit(1);
        })
    }
)();