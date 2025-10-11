import { Barretenberg, Fr } from "@aztec/bb.js";
import { ethers } from "ethers";

const FIELD_MODULUS = 21888242871839275222246405745257275088548364400416034343698204186575808495617n; // Prime field order

export function englishWordToField(word: string): Fr {
    let binaryString = "";
    for (let i = 0; i < word.length; i++) {
        binaryString += word.charCodeAt(i).toString(2).padStart(8, "0");
    }
    const wordBigInt = BigInt("0b" + binaryString);
    return new Fr(wordBigInt);
}


export default async function generateCommitment(): Promise<Fr> {

    const bb = await Barretenberg.new();

    const secret_key = Fr.fromString((0xdf57089febbacf7ba0bc227dafbffa9fc08a93fdc68e1e42411a14efcf23656en % FIELD_MODULUS).toString()); // example secret key
    const secret_answer_one = englishWordToField("apple"); // fruit
    const commitment = await bb.poseidon2Hash([secret_key,secret_answer_one]);

    
    bb.destroy();
    return commitment;
}


// (
//     async () => {
//         generateCommitment().then((result) => {
//             console.log("Commitment:", result.toString());
//            process.exit(0);
//         }).catch((error) => {
//             console.error(error);
//             process.exit(1);
//         })
//     }
// )();