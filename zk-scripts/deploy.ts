import fs from "fs/promises";
import { ethers } from "ethers";

const LINEA_SEPOLIA_RPC = "https://rpc.sepolia.linea.build";
const LINEA_SEPOLIA_CHAIN_ID = 59141;

async function main() {
    console.log("🚀 Deploying ZK Smart Account Recovery to Linea Sepolia...");
    
    const provider = new ethers.JsonRpcProvider(LINEA_SEPOLIA_RPC);
    const privateKey = process.env.PRIVATE_KEY;
    
    if (!privateKey) {
        throw new Error("❌ PRIVATE_KEY environment variable not set");
    }
    
    const deployer = new ethers.Wallet(privateKey, provider);
    const balance = await provider.getBalance(deployer.address);
    
    console.log(`📝 Deployer address: ${deployer.address}`);
    console.log(`💰 Balance: ${ethers.formatEther(balance)} ETH`);
    console.log(`🌐 Network: Linea Sepolia (Chain ID: ${LINEA_SEPOLIA_CHAIN_ID})`);

    const gasPrice = await provider.getFeeData();
    const gasOptions = {
        gasPrice: gasPrice.gasPrice ? gasPrice.gasPrice * BigInt(150) / BigInt(100) : ethers.parseUnits("1", "gwei"),
        gasLimit: 5000000n
    };
    
    console.log(`⛽ Gas price: ${ethers.formatUnits(gasOptions.gasPrice, "gwei")} gwei`);

    const Poseidon2Artifact = JSON.parse(await fs.readFile("./artifacts/contracts/poseidon/src/Poseidon2.sol/Poseidon2.json", "utf8"));
    const HonkVerifierArtifact = JSON.parse(await fs.readFile("./artifacts/contracts/Verifier.sol/HonkVerifier.json", "utf8"));
    const EntryPointArtifact = JSON.parse(await fs.readFile("./artifacts/contracts/EntryPoint.sol/EntryPoint.json", "utf8"));
    const SmartAccountFactoryArtifact = JSON.parse(await fs.readFile("./artifacts/contracts/SmartAccountFactory.sol/SmartAccountFactory.json", "utf8"));
    const ERC20MockArtifact = JSON.parse(await fs.readFile("./artifacts/contracts/ERC20Mock.sol/ERC20Mock.json", "utf8"));

    // Use existing Poseidon2
    console.log("\n1️⃣ Using existing Poseidon2...");
    const existingPoseidonAddress = "0xb92036C1E795FA54b13E7679c805915b43c7F089";
    const Poseidon2Factory = new ethers.ContractFactory(Poseidon2Artifact.abi, Poseidon2Artifact.bytecode, deployer);
    const hasher = Poseidon2Factory.attach(existingPoseidonAddress);
    console.log(`✅ Using Poseidon2 at: ${existingPoseidonAddress}`);

    // Deploy EntryPoint
    console.log("\n2️⃣ Deploying EntryPoint...");
    const EntryPointFactory = new ethers.ContractFactory(EntryPointArtifact.abi, EntryPointArtifact.bytecode, deployer);
    const entryPoint = await EntryPointFactory.deploy(gasOptions);
    await entryPoint.waitForDeployment();
    console.log(`✅ EntryPoint deployed to: ${await entryPoint.getAddress()}`);

    // Deploy HonkVerifier
    console.log("\n3️⃣ Deploying HonkVerifier...");
    const VerifierFactory = new ethers.ContractFactory(HonkVerifierArtifact.abi, HonkVerifierArtifact.bytecode, deployer);
    const honkVerifier = await VerifierFactory.deploy(gasOptions);
    await honkVerifier.waitForDeployment();
    console.log(`✅ HonkVerifier deployed to: ${await honkVerifier.getAddress()}`);

    // Deploy SmartAccountFactory
    console.log("\n4️⃣ Deploying SmartAccountFactory...");
    const FactoryFactory = new ethers.ContractFactory(SmartAccountFactoryArtifact.abi, SmartAccountFactoryArtifact.bytecode, deployer);
    const accountFactory = await FactoryFactory.deploy(
        await honkVerifier.getAddress(),
        await hasher.getAddress(),
        gasOptions
    );
    await accountFactory.waitForDeployment();
    console.log(`✅ SmartAccountFactory deployed to: ${await accountFactory.getAddress()}`);

    // Deploy ERC20Mock
    console.log("\n5️⃣ Deploying ERC20Mock...");
    const ERC20Factory = new ethers.ContractFactory(ERC20MockArtifact.abi, ERC20MockArtifact.bytecode, deployer);
    const erc20Mock = await ERC20Factory.deploy(gasOptions);
    await erc20Mock.waitForDeployment();
    console.log(`✅ ERC20Mock deployed to: ${await erc20Mock.getAddress()}`);

    const addresses = {
        network: "Linea Sepolia",
        chainId: LINEA_SEPOLIA_CHAIN_ID,
        rpcUrl: LINEA_SEPOLIA_RPC,
        deployer: deployer.address,
        poseidon2: await hasher.getAddress(),
        honkVerifier: await honkVerifier.getAddress(),
        entryPoint: await entryPoint.getAddress(),
        smartAccountFactory: await accountFactory.getAddress(),
        erc20Mock: await erc20Mock.getAddress(),
        deployedAt: new Date().toISOString()
    };

    console.log("\n📋 Deployment Summary:");
    console.log("================================");
    console.log(`Network: ${addresses.network}`);
    console.log(`Chain ID: ${addresses.chainId}`);
    console.log(`Deployer: ${addresses.deployer}`);
    console.log(`Poseidon2: ${addresses.poseidon2}`);
    console.log(`HonkVerifier: ${addresses.honkVerifier}`);
    console.log(`EntryPoint: ${addresses.entryPoint}`);
    console.log(`SmartAccountFactory: ${addresses.smartAccountFactory}`);
    console.log(`ERC20Mock: ${addresses.erc20Mock}`);

    console.log("\n🎉 Deployment completed successfully!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    });
