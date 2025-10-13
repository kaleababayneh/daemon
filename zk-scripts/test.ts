import { network } from "hardhat";
const { viem } = await network.connect();


const ACCOUNT_ADDR = "0xa16E02E87b7454126E5E10d957A927A7F5B5d2be"; 

async function main() {
    const account = await viem.getContractAt("SmartAccount", ACCOUNT_ADDR);
    const count = await account.read.count();
    console.log("Smart Account Count:", count);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});