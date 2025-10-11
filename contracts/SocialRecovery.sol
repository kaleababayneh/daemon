// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import { IVerifier } from "./Verifier.sol";


abstract contract SocialRecovery is EIP712 {
    using ECDSA for bytes32;

    // EIP-712 type hash for recovery messages
    bytes32 public constant RECOVER_TYPEHASH = 
        keccak256("Recover(address currentOwner,address newOwner,uint256 nonce)");

    // Events
    event GuardianSet(address indexed guardian);
    event AccountRecovered(address indexed oldOwner, address indexed newOwner, address indexed guardian);

    // Errors
    error InvalidGuardian();
    error InvalidNewOwner();
    error InvalidSignature();
    error InvalidNonce();
    error GuardianNotSet();

    // Storage
    address public guardian;

    mapping(address => uint256) private _nonces;

    constructor() EIP712("SmartAccount", "1") {}

    function setGuardian(address _guardian) external {
        require(msg.sender == _getOwner() || msg.sender == address(this), "Only owner can set guardian");
        require(_guardian != address(0), "Guardian cannot be zero address");
        require(_guardian != _getOwner(), "Guardian cannot be owner");
        require(_guardian != address(this), "Guardian cannot be this contract");
        
        guardian = _guardian;
        emit GuardianSet(_guardian);
    }


    function recoverAccount(
        address newOwner,
        uint256 nonce,
        bytes calldata signature
    ) external {
        if (guardian == address(0)) revert GuardianNotSet();
        if (newOwner == address(0) || newOwner == _getOwner() || newOwner == address(this)) {
            revert InvalidNewOwner();
        }

        

        address currentOwner = _getOwner();
        
        // Verify nonce
        if (nonce != _nonces[currentOwner]) revert InvalidNonce();
        _nonces[currentOwner]++;

        // Create EIP-712 structured data hash
        bytes32 structHash = keccak256(abi.encode(
            RECOVER_TYPEHASH,
            currentOwner,
            newOwner,
            nonce
        ));
        bytes32 digest = _hashTypedDataV4(structHash);

        // Verify guardian signature
        address recoveredAddress = digest.recover(signature);
        if (recoveredAddress != guardian) revert InvalidSignature();

        // Transfer ownership
        address oldOwner = currentOwner;
        _transferOwnership(newOwner);
        
        emit AccountRecovered(oldOwner, newOwner, guardian);
    }

  
    function getNonce(address addr) external view returns (uint256) {
        return _nonces[addr];
    }

    function _getOwner() internal view virtual returns (address);
    function _transferOwnership(address newOwner) internal virtual;
}