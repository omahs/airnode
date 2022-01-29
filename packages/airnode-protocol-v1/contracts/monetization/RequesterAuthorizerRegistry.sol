// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../utils/AddressRegistry.sol";
import "./interfaces/IRequesterAuthorizerRegistry.sol";

contract RequesterAuthorizerRegistry is
    AddressRegistry,
    IRequesterAuthorizerRegistry
{
    /// @param _accessControlRegistry AccessControlRegistry contract address
    /// @param _adminRoleDescription Admin role description
    /// @param _manager Manager address
    constructor(
        address _accessControlRegistry,
        string memory _adminRoleDescription,
        address _manager
    )
        AddressRegistry(_accessControlRegistry, _adminRoleDescription, _manager)
    {}

    function setChainRequesterAuthorizer(
        uint256 chainId,
        address requesterAuthorizer
    ) external override onlyRegistrarOrManager {
        require(chainId != 0, "Chain ID zero");
        (bool success, ) = tryReadChainRequesterAuthorizer(chainId);
        require(!success, "Chain Authorizer already set");
        _registerAddress(
            keccak256(abi.encodePacked(chainId)),
            requesterAuthorizer
        );
        emit SetChainRequesterAuthorizer(
            chainId,
            requesterAuthorizer,
            msg.sender
        );
    }

    function tryReadChainRequesterAuthorizer(uint256 chainId)
        public
        view
        override
        returns (bool success, address requesterAuthorizer)
    {
        (success, requesterAuthorizer) = tryReadRegisteredAddress(
            keccak256(abi.encodePacked(chainId))
        );
    }
}