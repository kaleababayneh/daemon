import { network } from "hardhat";
const { viem } = await network.connect();

async function main() {
    const [signer0] = await viem.getWalletClients();

    console.log(`Deploying contracts with account: ${signer0.account.address}`);

    // Deploy Poseidon hasher first (required by SocialRecovery)
    const hasher = await viem.deployContract("Poseidon2");
    console.log(`Poseidon2 deployed to ${hasher.address}`);

    // Deploy HonkVerifier (the actual ZK verifier from your Verifier.sol)
    const honkVerifier = await viem.deployContract("HonkVerifier");
    console.log(`HonkVerifier deployed to ${honkVerifier.address}`);

    // Deploy EntryPoint
    const ep = await viem.deployContract("EntryPoint");
    console.log(`EntryPoint deployed to ${ep.address}`);

    // Deploy SmartAccountFactory with the HonkVerifier and Poseidon2
    const af = await viem.deployContract("SmartAccountFactory", [honkVerifier.address, hasher.address]);
    console.log(`SmartAccountFactory deployed to ${af.address}`);

    // Deploy Paymaster
    const pm = await viem.deployContract("Paymaster");
    console.log(`Paymaster deployed to ${pm.address}`);

    // Deploy ERC20Mock for testing
    const erc20 = await viem.deployContract("ERC20Mock");
    console.log(`ERC20Mock deployed to ${erc20.address}`);

    console.log("\n=== DEPLOYMENT SUMMARY ===");
    console.log(`Poseidon2:           ${hasher.address}`);
    console.log(`HonkVerifier:        ${honkVerifier.address}`);
    console.log(`EntryPoint:          ${ep.address}`);
    console.log(`SmartAccountFactory: ${af.address}`);
    console.log(`Paymaster:           ${pm.address}`);
    console.log(`ERC20Mock:           ${erc20.address}`);
    console.log("===========================");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});