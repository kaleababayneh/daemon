// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.12;

import "@account-abstraction/contracts/core/EntryPoint.sol" as EP;

// This contract is just a wrapper to make EntryPoint deployable
contract EntryPoint is EP.EntryPoint {
    constructor() EP.EntryPoint() {}
}