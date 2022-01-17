// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "./Registry.sol";
import "./interfaces/IAddressRegistry.sol";

contract AddressRegistry is Registry, IAddressRegistry {
    mapping(bytes32 => address) private hashToAddress;

    /// @param _accessControlRegistry AccessControlRegistry contract address
    /// @param _adminRoleDescription Admin role description
    constructor(
        address _accessControlRegistry,
        string memory _adminRoleDescription
    ) Registry(_accessControlRegistry, _adminRoleDescription) {}

    function registerAddress(
        address user,
        bytes32 id,
        address address_
    ) public override onlyRegistrarOrUser(user) {
        hashToAddress[keccak256(abi.encodePacked(user, id))] = address_;
        emit RegisteredAddress(user, id, address_);
    }

    function readRegisteredAddress(address user, bytes32 id)
        external
        view
        override
        returns (address)
    {
        return hashToAddress[keccak256(abi.encodePacked(user, id))];
    }
}
