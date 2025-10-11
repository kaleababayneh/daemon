// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "hardhat/console.sol";
import { HonkVerifier } from "./Verifier.sol";
import { Poseidon2, Field } from "./poseidon/src/Poseidon2.sol";


abstract contract SocialRecovery is EIP712 {
    using ECDSA for bytes32;

    Poseidon2 public immutable i_hasher;
    HonkVerifier public immutable i_verifier;

    // EIP-712 type hash for recovery messages
    bytes32 public constant RECOVER_TYPEHASH = 
        keccak256("Recover(address currentOwner,address newOwner,uint256 nonce)");

    // Events
    event GuardianSet(bytes32 guardian);
    event AccountRecovered(address indexed oldOwner, address indexed newOwner);

    // Errors
    error InvalidGuardian();
    error InvalidNewOwner();
    error InvalidSignature();
    error InvalidNonce();
    error GuardianNotSet();
    error SocialRecovery__InvalidProof();
    error SocialRecovery__GuardianAlreadySet();

    // Storage
    bytes32 public guardianCommitments;
    uint256 public guardianCount;
    mapping(bytes32 => bool) public usedNullifiers; // Track used nullifiers

    mapping(address => uint256) private _nonces;

    constructor(HonkVerifier _verifier, Poseidon2 _hasher) EIP712("SmartAccount", "1") {
        i_hasher = _hasher;
        i_verifier = _verifier;
    }

    function setGuardian(bytes32 _guardian) external {
        require(msg.sender == _getOwner() || msg.sender == address(this), "Only owner can set guardian");
        require(_guardian != bytes32(0), "Guardian cannot be zero address");
        
        // Check if guardian is already set to avoid duplicate
        if (guardianCommitments == _guardian) {
            return; // Guardian already set, no need to update
        }

        guardianCommitments = _guardian;
        guardianCount += 1;
        emit GuardianSet(_guardian);
    }

    function recoverAccount(
        address newOwner,
        uint256 /*nonce*/,
        bytes32 nullifierHash,
        bytes calldata _proof
    ) external {
        
        bytes32 guardiansCommitment = getGuardianCommitments();
       
        // Convert addresses to bytes32 like the contract does
        address currentOwner = _getOwner();
        bytes32 currentOwnerBytes32 = bytes32(uint256(uint160(currentOwner)));
        bytes32 newOwnerBytes32 = bytes32(uint256(uint160(newOwner)));
        
       
        bytes32[] memory publicInputs = new bytes32[](4);
        publicInputs[0] = nullifierHash;
        publicInputs[1] = guardiansCommitment;
        publicInputs[2] = newOwnerBytes32;
        publicInputs[3] = currentOwnerBytes32;
        
        bool isValid = i_verifier.verify(_proof, publicInputs);
        if (!isValid) {
            revert SocialRecovery__InvalidProof();
        }

        // Transfer ownership
        address oldOwner = currentOwner;
        _transferOwnership(newOwner);

        emit AccountRecovered(oldOwner, newOwner);
    }

    function getNonce(address addr) external view returns (uint256) {
        return _nonces[addr];
    }

    // Helper function to get guardian commitments
    function getGuardianCommitments() public view returns (bytes32) {
        return guardianCommitments;
    }

    function _getOwner() internal view virtual returns (address);
    function _transferOwnership(address newOwner) internal virtual;
}