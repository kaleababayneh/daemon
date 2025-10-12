import fs from "fs/promises";
import { ethers } from "ethers";

// Base Sepolia configuration
const BASE_SEPOLIA_RPC = "https://base-sepolia-public.nodies.app";
const BASE_SEPOLIA_CHAIN_ID = 84532;
// We'll deploy our own EntryPoint instead of using the existing one

async function main() {
    console.log("🚀 Deploying ZK Smart Account Recovery to Base Sepolia...");
    
    // Setup provider and wallet using ethers directly
    const provider = new ethers.JsonRpcProvider(BASE_SEPOLIA_RPC);
    const privateKey = process.env.PRIVATE_KEY;
    
    if (!privateKey) {
        throw new Error("❌ PRIVATE_KEY environment variable not set");
    }
    
    const deployer = new ethers.Wallet(privateKey, provider);
    const balance = await provider.getBalance(deployer.address);
    
    console.log(`📝 Deployer address: ${deployer.address}`);
    console.log(`💰 Balance: ${ethers.formatEther(balance)} ETH`);
    console.log(`🌐 Network: Base Sepolia (Chain ID: ${BASE_SEPOLIA_CHAIN_ID})`);
    
    if (parseFloat(ethers.formatEther(balance)) < 0.1) {
        console.log("⚠️  Warning: Low balance. You may need more ETH for deployment.");
    }

    // Load contract artifacts using fs
    const Poseidon2Artifact = JSON.parse(await fs.readFile("./artifacts/contracts/poseidon/src/Poseidon2.sol/Poseidon2.json", "utf8"));
    const HonkVerifierArtifact = JSON.parse(await fs.readFile("./artifacts/contracts/Verifier.sol/HonkVerifier.json", "utf8"));
    const EntryPointArtifact = JSON.parse(await fs.readFile("./artifacts/contracts/EntryPoint.sol/EntryPoint.json", "utf8"));
    const SmartAccountFactoryArtifact = JSON.parse(await fs.readFile("./artifacts/contracts/SmartAccountFactory.sol/SmartAccountFactory.json", "utf8"));
    const ERC20MockArtifact = JSON.parse(await fs.readFile("./artifacts/contracts/ERC20Mock.sol/ERC20Mock.json", "utf8"));

    // 1. Deploy Poseidon2 hasher first (required by SocialRecovery)
    console.log("\n1️⃣ Deploying Poseidon2 hasher...");
    const Poseidon2Factory = new ethers.ContractFactory(Poseidon2Artifact.abi, Poseidon2Artifact.bytecode, deployer);
    const hasher = await Poseidon2Factory.deploy();
    await hasher.waitForDeployment();
    console.log(`✅ Poseidon2 deployed to: ${await hasher.getAddress()}`);

    // 2. Deploy our own EntryPoint
    console.log("\n2️⃣ Deploying EntryPoint...");
    const EntryPointFactory = new ethers.ContractFactory(EntryPointArtifact.abi, EntryPointArtifact.bytecode, deployer);
    const entryPoint = await EntryPointFactory.deploy();
    await entryPoint.waitForDeployment();
    console.log(`✅ EntryPoint deployed to: ${await entryPoint.getAddress()}`);

    // 3. Deploy HonkVerifier (ZK proof verifier)
    console.log("\n3️⃣ Deploying HonkVerifier...");
    const VerifierFactory = new ethers.ContractFactory(HonkVerifierArtifact.abi, HonkVerifierArtifact.bytecode, deployer);
    const honkVerifier = await VerifierFactory.deploy();
    await honkVerifier.waitForDeployment();
    console.log(`✅ HonkVerifier deployed to: ${await honkVerifier.getAddress()}`);

    // 4. Deploy SmartAccountFactory (using our own EntryPoint)
    console.log("\n4️⃣ Deploying SmartAccountFactory...");
    const FactoryFactory = new ethers.ContractFactory(SmartAccountFactoryArtifact.abi, SmartAccountFactoryArtifact.bytecode, deployer);
    const accountFactory = await FactoryFactory.deploy(
        await honkVerifier.getAddress(),
        await hasher.getAddress()
    );
    await accountFactory.waitForDeployment();
    console.log(`✅ SmartAccountFactory deployed to: ${await accountFactory.getAddress()}`);

    // 5. Deploy ERC20Mock for testing
    console.log("\n5️⃣ Deploying ERC20Mock for testing...");
    const ERC20Factory = new ethers.ContractFactory(ERC20MockArtifact.abi, ERC20MockArtifact.bytecode, deployer);
    const erc20Mock = await ERC20Factory.deploy(); // No constructor arguments needed
    await erc20Mock.waitForDeployment();
    console.log(`✅ ERC20Mock deployed to: ${await erc20Mock.getAddress()}`);

    // 6. Create a demo smart account
    console.log("\n6️⃣ Creating demo smart account...");
    
    // Call the createAccount function with entryPoint address - using getFunction to get proper typing
    const createAccountFunction = accountFactory.getFunction("createAccount");
    const createTx = await createAccountFunction(await entryPoint.getAddress());
    const receipt = await createTx.wait();
    
    // Get the smart account address from the event or return value
    let smartAccountAddress: string;
    
    // First try to get from events
    const smartAccountCreatedTopic = ethers.id("SmartAccountCreated(address)");
    const event = receipt?.logs.find((log: any) => log.topics && log.topics[0] === smartAccountCreatedTopic);
    
    if (event && event.data) {
        smartAccountAddress = ethers.AbiCoder.defaultAbiCoder().decode(["address"], event.data)[0];
    } else {
        // If no event found, the function might return the address directly
        smartAccountAddress = createTx.value || "0x0000000000000000000000000000000000000000";
    }
    
    console.log(`✅ Smart account created at: ${smartAccountAddress}`);

    // Summary
    const addresses = {
        network: "Base Sepolia",
        chainId: BASE_SEPOLIA_CHAIN_ID,
        rpcUrl: BASE_SEPOLIA_RPC,
        deployer: deployer.address,
        poseidon2: await hasher.getAddress(),
        honkVerifier: await honkVerifier.getAddress(),
        entryPoint: await entryPoint.getAddress(),
        smartAccountFactory: await accountFactory.getAddress(),
        smartAccount: smartAccountAddress,
        erc20Mock: await erc20Mock.getAddress(),
        deployedAt: new Date().toISOString()
    };

    console.log("\n🎉 === BASE SEPOLIA DEPLOYMENT SUMMARY ===");
    console.log(`Deployer:            ${addresses.deployer}`);
    console.log(`Poseidon2:           ${addresses.poseidon2}`);
    console.log(`HonkVerifier:        ${addresses.honkVerifier}`);
    console.log(`EntryPoint (Custom): ${addresses.entryPoint}`);
    console.log(`SmartAccountFactory: ${addresses.smartAccountFactory}`);
    console.log(`Demo SmartAccount:   ${addresses.smartAccount}`);
    console.log(`ERC20Mock:           ${addresses.erc20Mock}`);
    console.log("==========================================");

    // Save deployment addresses
    await fs.writeFile(
        "./base-sepolia-deployment.json",
        JSON.stringify(addresses, null, 2)
    );
    console.log("\n💾 Deployment addresses saved to base-sepolia-deployment.json");
    
    // Generate frontend update commands
    console.log("\n📝 Frontend update commands:");
    console.log(`SMART_ACCOUNT_ADDRESS = '${addresses.smartAccount}'`);
    console.log(`FACTORY_ADDRESS = '${addresses.smartAccountFactory}'`);
    console.log(`ENTRY_POINT_ADDRESS = '${addresses.entryPoint}'`);
    console.log(`ERC20_MOCK_ADDRESS = '${addresses.erc20Mock}'`);
    
    return addresses;
}

main().catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exitCode = 1;
});

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});