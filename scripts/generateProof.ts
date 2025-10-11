import { Barretenberg, Fr, UltraHonkBackend } from "@aztec/bb.js";
import { ethers } from "ethers";
import { Noir } from "@noir-lang/noir_js";
import fs from "fs";
import path from "path";

const circuit = JSON.parse(
    fs.readFileSync(
        path.resolve(__dirname, "../circuits/target/circuits.json"),
        "utf-8"
    )
);


export function englishWordToField(word: string): Fr {
    let binaryString = "";
    for (let i = 0; i < word.length; i++) {
        binaryString += word.charCodeAt(i).toString(2).padStart(8, "0");
    }
    const wordBigInt = BigInt("0b" + binaryString);
    return new Fr(wordBigInt);
}


export default async function generateProof(): Promise<any> {
    const bb = await Barretenberg.new();




    const secret_key = Fr.fromString("0xdf57089febbacf7ba0bc227dafbffa9fc08a93fdc68e1e42411a14efcf23656e");
    const secret_answer_one = englishWordToField("apple"); // fruit
    const secret_answer_two = englishWordToField("dog"); // animal
    const current_owner = Fr.fromString("0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266");
    const new_owner = Fr.fromString("0xdd2fd4581271e230360230f9337d5c0430bf44c0");


    const nullifier_hash = await bb.poseidon2Hash([secret_key,secret_answer_one,current_owner]);


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
            // public inputs
            nullifier_hash: nullifier_hash.toString(),
            guardians_commitment: [11111, 22222, 33333, 44444, 55555, 66666, 77777, 88888, 99999, 101010].map((x) => Fr.fromString(x.toString()).toString()),
            new_owner: new_owner.toString(),
            current_owner: current_owner.toString(),
            // private inputs
            secret_answer_one: secret_answer_one.toString(),
            secret_answer_two: secret_answer_two.toString(),
            secret_key: secret_key.toString(),
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
            nullifier_hash.toBuffer(),
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