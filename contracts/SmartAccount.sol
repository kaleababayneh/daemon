// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;


import "@account-abstraction/contracts/core/EntryPoint.sol";
import "@account-abstraction/contracts/interfaces/IAccount.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@account-abstraction/contracts/core/Helpers.sol";
import "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import "./SocialRecovery.sol";



contract SmartAccount is IAccount, Ownable, SocialRecovery {

  uint256 public count;
  IEntryPoint private immutable i_entryPoint;
  error MinimalAccount__NotFromEntryPoint();
  error MinimalAccount__NotFromEntryPointOrOwner();
  error MinimalAccount__CallFailed(bytes);


  using MessageHashUtils for bytes32;

    
    modifier requireFromEntryPoint() {
        if (msg.sender != address(i_entryPoint)) {
            revert MinimalAccount__NotFromEntryPoint();
        }
        _;
    }

    modifier requireFromEntryPointOrOwner() {
        if (msg.sender != address(i_entryPoint) && msg.sender != owner()) {
            revert MinimalAccount__NotFromEntryPointOrOwner();
        }
        _;
    }


    constructor(address entryPoint) Ownable(msg.sender) {
        i_entryPoint = IEntryPoint(entryPoint);
    }

    receive() external payable {}


  function validateUserOp(PackedUserOperation calldata userOp, bytes32 userOpHash, uint256 /*missingAccountFunds*/)
    external view requireFromEntryPoint returns (uint256 validationData) {

     address recovered = ECDSA.recover(userOpHash.toEthSignedMessageHash(), userOp.signature);

      //return owner() == recovered ? 0 : 1;
      if (owner() != recovered) {
          return SIG_VALIDATION_FAILED;
      }
      return SIG_VALIDATION_SUCCESS;
    }

    function execute(address dest, uint256 value, bytes calldata functionData) external requireFromEntryPointOrOwner {
        (bool success, bytes memory result) = dest.call{value: value}(functionData);
        if (!success) {
            revert MinimalAccount__CallFailed(result);
        }
    }

    // function execute() external requireFromEntryPointOrOwner {
    //     count++;
    // }


    function getEntrypoint() external view returns (IEntryPoint) {
        return i_entryPoint;
    }

    // Implement SocialRecovery abstract functions
    function _getOwner() internal view override returns (address) {
        return owner();
    }

    function _transferOwnership(address newOwner) internal override(Ownable, SocialRecovery) {
        Ownable._transferOwnership(newOwner);
    }
}