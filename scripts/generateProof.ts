import { Barretenberg, Fr, UltraHonkBackend } from "@aztec/bb.js";
import { ethers } from "ethers";
import { Noir } from "@noir-lang/noir_js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import generateCommitment, { englishWordToField } from "./generateCommitment.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const circuit = JSON.parse(
    fs.readFileSync(
        path.resolve(__dirname, "../circuits/target/circuits.json"),
        "utf-8"
    )
);

const FIELD_MODULUS = 21888242871839275222246405745257275088548364400416034343698204186575808495617n; // Prime field order


export default async function generateProof(): Promise<any> {
    const bb = await Barretenberg.new();


    const secret_key = Fr.fromString((0xdf57089febbacf7ba0bc227dafbffa9fc08a93fdc68e1e42411a14efcf23656en % FIELD_MODULUS).toString()); // example secret key
    const secret_answer_one = englishWordToField("apple"); // fruit
    const secret_answer_two = englishWordToField("dog"); // animal
    const current_owner = new Fr(BigInt("0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266"));
    const new_owner = new Fr(BigInt("0xdd2fd4581271e230360230f9337d5c0430bf44c0"));


    const nullifier_hash = await bb.poseidon2Hash([secret_key,secret_answer_two,new_owner,current_owner]);
    const commitment = await generateCommitment();

    console.log("Commitment:", commitment.toString());
    console.log("Nullifier Hash:", nullifier_hash.toString());

    bb.destroy();

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
            
            nullifier_hash: nullifier_hash.toString(),
            guardians_commitment: [commitment.toString(), "1", "2", "3", "4", "5", "6", "7", "8", "9"], // Padding to match [Field; 10]
            new_owner: new_owner.toString(),
            current_owner: current_owner.toString(),

            secret_answer_one: secret_answer_one.toString(),
            secret_answer_two: secret_answer_two.toString(),
            secret_key: secret_key.toString(),
        }

        const { witness } = await noir.execute(input);
        const { proof } = await honk.generateProof(witness, {
            keccak: true,
        });

        return proof;
    } catch (error) {
        console.error("Error generating proof:", error);
        throw error;
    }
}


(
    async () => {
        generateProof().then((result) => {
            console.log("Proof:", result);
              process.exit(0);
        }).catch((error) => {
            console.error(error);
            process.exit(1);
        })
    }
)();