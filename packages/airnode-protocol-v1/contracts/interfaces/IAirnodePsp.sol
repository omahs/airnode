// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "./IAirnodeRrp.sol";

interface IAirnodePsp is IAirnodeRrp {
    event CreatedSubscription(
        bytes32 indexed subscriptionId,
        bytes32 templateId,
        bytes parameters,
        bytes conditions,
        address sponsor,
        address requester,
        bytes4 fulfillFunctionId
    );

    event FulfilledSubscription(
        address indexed airnode,
        bytes32 indexed subscriptionId,
        uint256 timestamp,
        bytes data
    );

    event FulfilledSubscriptionRelayed(
        address indexed relayer,
        bytes32 indexed subscriptionId,
        address indexed airnode,
        uint256 timestamp,
        bytes data
    );

    function createSubscription(
        bytes32 templateId,
        bytes calldata parameters,
        bytes calldata conditions,
        address sponsor,
        address requester,
        bytes4 fulfillFunctionId
    ) external returns (bytes32 subscriptionId);

    function fulfillSubscription(
        bytes32 subscriptionId,
        uint256 timestamp,
        bytes calldata data,
        bytes calldata signature
    ) external returns (bool callSuccess, bytes memory callData);

    function fulfillSubscriptionRelayed(
        bytes32 subscriptionId,
        address relayer,
        uint256 timestamp,
        bytes calldata data,
        bytes calldata signature
    ) external returns (bool callSuccess, bytes memory callData);

    function subscriptions(bytes32 subscriptionId)
        external
        view
        returns (
            bytes32 templateId,
            bytes memory parameters,
            bytes memory conditions,
            address sponsor,
            address requester,
            bytes4 fulfillFunctionId
        );
}