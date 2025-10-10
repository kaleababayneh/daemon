import { Barretenberg, Fr } from "@aztec/bb.js";
import { ethers } from "ethers";



export default async function generateCommitment(): Promise<string> {


    const bb = await Barretenberg.new();
    const secret_key = Fr.random();
    const secret_answer_two = Fr.random();
    const new_owner = Fr.random();
    const current_owner = Fr.random();

    const commitment: Fr = await bb.poseidon2Hash([secret_key, secret_answer_two, new_owner, current_owner]);

    const result = ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "bytes32", "bytes32", "bytes32", "bytes32"],
        [commitment.toBuffer(), secret_key.toBuffer(), secret_answer_two.toBuffer(), new_owner.toBuffer(), current_owner.toBuffer()]

    );
    bb.destroy();
    return result;
}


(
    async () => {
        generateCommitment().then((result) => {
           process.stdout.write(result);
           process.exit(0);
        }).catch((error) => {
            console.error(error);
            process.exit(1);
        })
    }
)();