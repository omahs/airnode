// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../utils/Uint256Registry.sol";
import "./interfaces/IAirnodeEndpointFeeRegistry.sol";

/// @title Contract that stores the price of accessing Airnode endpoints across
/// different chains
/// @notice AirnodeFeeRegistry is a central contract that can be queried for
/// the USD price of an Airnode–chain–endpoint pair
contract AirnodeEndpointFeeRegistry is
    Uint256Registry,
    IAirnodeEndpointFeeRegistry
{
    /// @notice A flag to determine which price to default to
    /// @dev See `getPrice()` for details
    mapping(address => bool)
        public
        override prioritizeEndpointPriceOverChainPrice;

    string public constant override DENOMINATION = "USD";

    uint256 public constant override DECIMALS = 18;

    uint256 public constant override PRICING_INTERVAL = 30 days;

    bytes32 private constant DEFAULT_PRICE_ID =
        keccak256(abi.encodePacked("Default price"));

    bytes32 private constant SALT =
        keccak256(abi.encodePacked("Salt to avoid hash collision"));

    /// @dev Reverts if Airnode address is zero
    /// @param airnode Airnode address
    modifier onlyNonZeroAirnode(address airnode) {
        require(airnode != address(0), "Airnode address zero");
        _;
    }

    /// @dev Reverts if Chain ID is zero
    /// @param chainId Chain ID
    modifier onlyNonZeroChainId(uint256 chainId) {
        require(chainId != 0, "Chain ID zero");
        _;
    }

    /// @param _accessControlRegistry AccessControlRegistry contract address
    /// @param _adminRoleDescription Admin role description
    /// @param _manager Manager address
    constructor(
        address _accessControlRegistry,
        string memory _adminRoleDescription,
        address _manager
    )
        Uint256Registry(_accessControlRegistry, _adminRoleDescription, _manager)
    {}

    /// @notice Called to set the default price
    /// @param price Price in USD (times 10^18)
    function setDefaultPrice(uint256 price)
        external
        override
        onlyRegistrarOrManager
    {
        _registerUint256(DEFAULT_PRICE_ID, price);
        emit SetDefaultPrice(price, msg.sender);
    }

    /// @notice Called to set the default chain price
    /// @param chainId Chain ID
    /// @param price Price in USD (times 10^18)
    function setDefaultChainPrice(uint256 chainId, uint256 price)
        external
        override
        onlyRegistrarOrManager
    {
        _registerUint256(
            keccak256(abi.encodePacked(DEFAULT_PRICE_ID, chainId)),
            price
        );
        emit SetDefaultChainPrice(chainId, price, msg.sender);
    }

    /// @notice Called to set the Airnode price
    /// @param airnode Airnode address
    /// @param price Price in USD (times 10^18)
    function setAirnodePrice(address airnode, uint256 price)
        external
        override
        onlyRegistrarOrManager
        onlyNonZeroAirnode(airnode)
    {
        _registerUint256(keccak256(abi.encodePacked(airnode)), price);
        emit SetAirnodePrice(airnode, price, msg.sender);
    }

    /// @notice Called to set the Airnode chain price
    /// @param airnode Airnode address
    /// @param chainId Chain ID
    /// @param price Price in USD (times 10^18)
    function setAirnodeChainPrice(
        address airnode,
        uint256 chainId,
        uint256 price
    )
        external
        override
        onlyRegistrarOrManager
        onlyNonZeroAirnode(airnode)
        onlyNonZeroChainId(chainId)
    {
        _registerUint256(keccak256(abi.encodePacked(airnode, chainId)), price);
        emit SetAirnodeChainPrice(airnode, chainId, price, msg.sender);
    }

    /// @notice Called to set the Airnode endpoint price
    /// @dev The registry ID hash is salted in case the Airnode is not using
    /// hashes for `endpointId` as they are supposed to and numbers instead,
    /// which may be the same as chain IDs and result in collision.
    /// @param airnode Airnode address
    /// @param endpointId Endpoint ID (allowed to be `bytes32(0)`)
    /// @param price Price in USD (times 10^18)
    function setAirnodeEndpointPrice(
        address airnode,
        bytes32 endpointId,
        uint256 price
    ) external override onlyRegistrarOrManager onlyNonZeroAirnode(airnode) {
        _registerUint256(
            keccak256(abi.encodePacked(SALT, airnode, endpointId)),
            price
        );
        emit SetAirnodeEndpointPrice(airnode, endpointId, price, msg.sender);
    }

    /// @notice Called to set the Airnode chain endpoint price
    /// @param airnode Airnode address
    /// @param chainId Chain ID
    /// @param endpointId Endpoint ID (allowed to be `bytes32(0)`)
    /// @param price Price in USD (times 10^18)
    function setAirnodeChainEndpointPrice(
        address airnode,
        uint256 chainId,
        bytes32 endpointId,
        uint256 price
    )
        external
        override
        onlyRegistrarOrManager
        onlyNonZeroAirnode(airnode)
        onlyNonZeroChainId(chainId)
    {
        _registerUint256(
            keccak256(abi.encodePacked(airnode, chainId, endpointId)),
            price
        );
        emit SetAirnodeChainEndpointPrice(
            airnode,
            chainId,
            endpointId,
            price,
            msg.sender
        );
    }

    /// @notice Called to set if the endpoint or the chain price will be
    /// prioritized for the Airnode
    /// @param airnode Airnode address
    /// @param status Flag status, `true` prioritizes the endpoint price,
    /// `false` prioritizes the chain price (default)
    function setEndpointAndChainPricePriority(address airnode, bool status)
        external
        override
        onlyRegistrarOrManager
        onlyNonZeroAirnode(airnode)
    {
        prioritizeEndpointPriceOverChainPrice[airnode] = status;
        emit SetEndpointAndChainPricePriority(airnode, status, msg.sender);
    }

    /// @notice Called to get the default price
    /// @return success If the price was set
    /// @return price Price in USD (times 10^18)
    function getDefaultPrice()
        public
        view
        override
        returns (bool success, uint256 price)
    {
        (success, price) = tryReadRegisteredUint256(DEFAULT_PRICE_ID);
    }

    /// @notice Called to get the default chain price
    /// @param chainId Chain ID
    /// @return success If the price was set
    /// @return price Price in USD (times 10^18)
    function getDefaultChainPrice(uint256 chainId)
        public
        view
        override
        returns (bool success, uint256 price)
    {
        (success, price) = tryReadRegisteredUint256(
            keccak256(abi.encodePacked(DEFAULT_PRICE_ID, chainId))
        );
    }

    /// @notice Called to get the Airnode price
    /// @param airnode Airnode address
    /// @return success If the price was set
    /// @return price Price in USD (times 10^18)
    function getAirnodePrice(address airnode)
        public
        view
        override
        returns (bool success, uint256 price)
    {
        (success, price) = tryReadRegisteredUint256(
            keccak256(abi.encodePacked(airnode))
        );
    }

    /// @notice Called to get the Airnode, chain price
    /// @param airnode Airnode address
    /// @param chainId Chain ID
    /// @return success If the price was set
    /// @return price Price in USD (times 10^18)
    function getAirnodeChainPrice(address airnode, uint256 chainId)
        public
        view
        override
        returns (bool success, uint256 price)
    {
        (success, price) = tryReadRegisteredUint256(
            keccak256(abi.encodePacked(airnode, chainId))
        );
    }

    /// @notice Called to get the Airnode, endpoint price
    /// @dev The registry ID hash is salted in case the Airnode is not using
    /// hashes for `endpointId` as they are supposed to and numbers instead,
    /// which may be the same as chain IDs and result in collision.
    /// @param airnode Airnode address
    /// @param endpointId Endpoint ID
    /// @return success If the price was set
    /// @return price Price in USD (times 10^18)
    function getAirnodeEndpointPrice(address airnode, bytes32 endpointId)
        public
        view
        override
        returns (bool success, uint256 price)
    {
        (success, price) = tryReadRegisteredUint256(
            keccak256(abi.encodePacked(SALT, airnode, endpointId))
        );
    }

    /// @notice Called to get the Airnode, chain, endpoint price
    /// @param airnode Airnode address
    /// @param chainId Chain ID
    /// @param endpointId Endpoint ID
    /// @return success If the price was set
    /// @return price Price in USD (times 10^18)
    function getAirnodeChainEndpointPrice(
        address airnode,
        uint256 chainId,
        bytes32 endpointId
    ) public view override returns (bool success, uint256 price) {
        (success, price) = tryReadRegisteredUint256(
            keccak256(abi.encodePacked(airnode, chainId, endpointId))
        );
    }

    /// @notice Called to get the price that should be used for the given
    /// Airnode, chain and endpoint
    /// @dev The logic prioritizes more specific prices over less specific
    /// prices. There is ambiguity in if Airnode + chain or Airnode + endpoint
    /// should be prioritize, which we made to configurable (defaults to
    /// prioritizing Airnode + chain).
    /// Reverts if no price is set.
    /// @param airnode Airnode address
    /// @param chainId Chain ID
    /// @param endpointId Endpoint ID
    /// @return price Price in USD (times 10^18)
    function getPrice(
        address airnode,
        uint256 chainId,
        bytes32 endpointId
    ) external view override returns (uint256 price) {
        bool success;
        (success, price) = getAirnodeChainEndpointPrice(
            airnode,
            chainId,
            endpointId
        );
        if (success) {
            return price;
        }
        if (prioritizeEndpointPriceOverChainPrice[airnode]) {
            (success, price) = getAirnodeEndpointPrice(airnode, endpointId);
            if (success) {
                return price;
            }
            (success, price) = getAirnodeChainPrice(airnode, chainId);
            if (success) {
                return price;
            }
        } else {
            (success, price) = getAirnodeChainPrice(airnode, chainId);
            if (success) {
                return price;
            }
            (success, price) = getAirnodeEndpointPrice(airnode, endpointId);
            if (success) {
                return price;
            }
        }
        (success, price) = getAirnodePrice(airnode);
        if (success) {
            return price;
        }
        (success, price) = getDefaultChainPrice(chainId);
        if (success) {
            return price;
        }
        (success, price) = getDefaultPrice();
        if (success) {
            return price;
        }
        revert("No default price");
    }
}