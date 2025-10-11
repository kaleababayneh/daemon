// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./SmartAccount.sol";
import { HonkVerifier } from "./Verifier.sol";
import { Poseidon2 } from "./poseidon/src/Poseidon2.sol";


contract SmartAccountFactory {
    event SmartAccountCreated(address smartAccount);

    HonkVerifier public immutable verifier;
    Poseidon2 public immutable hasher;

    constructor(address _verifier, address _hasher) {
        verifier = HonkVerifier(_verifier);
        hasher = Poseidon2(_hasher);
    }

    function createAccount(address _entryPoint) external returns (address) {
        SmartAccount smartAccount = new SmartAccount(_entryPoint, verifier, hasher);
        smartAccount.transferOwnership(msg.sender);
        emit SmartAccountCreated(address(smartAccount));
        return address(smartAccount);
    }
}