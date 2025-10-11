import { network } from "hardhat";
const { viem } = await network.connect();
import { getCreateAddress } from "ethers";
import { encodeFunctionData, hashMessage } from "viem/utils";

/**
AF deployed to 0x5fbdb2315678afecb367f032d93f642f64180aa3
EP deployed to 0xe7f1725e7734ce288f8367e1bb143e90bb3f0512
PM deployed to 0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0
ERC20Mock deployed to 0xcf7ed3acca5a467e9e704c703e8d87f634fb0fc9
 */

const FACTORY_NONCE = 1;
const FACTORY_ADDR = "0x5fbdb2315678afecb367f032d93f642f64180aa3"; 
const EP_ADDR = "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512";      
const PM_ADDR = "0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0";     
const ERC20Mock_ADDR = "0xcf7ed3acca5a467e9e704c703e8d87f634fb0fc9";

async function main() {
    const [signer0, signer1] = await viem.getWalletClients();
    const publicClient = await viem.getPublicClient();
    const entryPoint = await viem.getContractAt("EntryPoint", EP_ADDR);
    const usdc = await viem.getContractAt("ERC20Mock", ERC20Mock_ADDR);
    
    const sender = getCreateAddress({
        from: FACTORY_ADDR,
        nonce: FACTORY_NONCE
    }) as `0x${string}`;

    const nonce = await entryPoint.read.getNonce([sender, 0n]);

    const accountCode = await publicClient.getCode({ address: sender });

    if (!accountCode || accountCode === "0x") {
        const AccountFactory = await viem.getContractAt("SmartAccountFactory", FACTORY_ADDR);
        const createTx = await AccountFactory.write.createAccount([EP_ADDR]);
        await publicClient.waitForTransactionReceipt({ hash: createTx });
        console.log("Account created!");
    }

    const Account = await viem.getContractAt("SmartAccount", sender);
    
    // Fix 1: Mint tokens TO the smart account, not to the ERC20Mock contract
    let value = 1_000_000_000_000_000n;
    const mintCalldata = encodeFunctionData({
        abi: usdc.abi,
        functionName: "mint",
        args: [sender, value] // Mint TO the smart account address
    });

    // Fix 2: Call mint on the ERC20Mock contract, send 0 ETH value
    const callData = encodeFunctionData({
        abi: Account.abi,
        functionName: "execute",
        args: [
            ERC20Mock_ADDR, // Target: ERC20Mock contract
            0n,             // Value: 0 ETH (we're not sending ETH)
            mintCalldata    // Data: mint function call
        ]
    });

    // Fund the account
    await entryPoint.write.depositTo([sender], { 
        value: 1_000_000_000_000_000n 
    });

    const userOp = {
        sender,
        nonce,
        initCode: "0x" as `0x${string}`, 
        callData,
        accountGasLimits: "0x000000000000000000000000000186a0000000000000000000000000000186a0" as `0x${string}`,
        preVerificationGas: 50000n, 
        gasFees: "0x0000000000000000000000000000000100000000000000000000000000000001" as `0x${string}`,
        paymasterAndData: "0x" as `0x${string}`,
        signature: "0x" as `0x${string}`,
    };

    const userOpHash = await entryPoint.read.getUserOpHash([userOp]);
    console.log("UserOpHash:", userOpHash);
        
    const signature = await signer0.signMessage({ 
        message: { raw: userOpHash }
    });
    
    userOp.signature = signature;

    console.log("Executing UserOp:", userOp);
    
    const txHash = await entryPoint.write.handleOps([[userOp], signer0.account.address]);
    console.log("Transaction hash:", txHash);
    
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    console.log("Success! Block:", receipt.blockNumber);

    console.log("Verifying balance...");
    const bal = await usdc.read.balanceOf([sender]);
    console.log("USDC Balance:", bal);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});