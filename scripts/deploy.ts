import { network } from "hardhat";
const { viem } = await network.connect();
import { ethers } from "ethers";

async function main() {
    const [signer0] = await viem.getWalletClients();

    console.log(`Deploying contracts with account: ${signer0.account.address}`);

    const af = await viem.deployContract("SmartAccountFactory");
    console.log(`AF deployed to ${af.address}`);

    const ep = await viem.deployContract("EntryPoint")
    console.log(`EP deployed to ${ep.address}`);

    const pm = await viem.deployContract("Paymaster");
    console.log(`PM deployed to ${pm.address}`);

    const erc20mock = await viem.deployContract("ERC20Mock");
    console.log(`ERC20Mock deployed to ${erc20mock.address}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});