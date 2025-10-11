// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./SmartAccount.sol";


contract SmartAccountFactory  {

    event SmartAccountCreated(address smartAccount);

   
    function createAccount(address _entryPoint) external returns (address) {

        SmartAccount smartAccount = new SmartAccount(_entryPoint);
        smartAccount.transferOwnership(msg.sender);
        emit SmartAccountCreated(address(smartAccount));
        return address(smartAccount);
    }
}