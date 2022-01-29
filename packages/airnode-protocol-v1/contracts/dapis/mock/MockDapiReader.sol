// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../DapiReader.sol";

contract MockDapiReader is DapiReader {
    /// @param _dapiServer DapiServer contract address
    constructor(address _dapiServer) DapiReader(_dapiServer) {}

    function exposedSetDapiServer(address _dapiServer) external {
        setDapiServer(_dapiServer);
    }

    function exposedReadWithDataPointId(bytes32 dataPointId)
        external
        view
        returns (int224 value, uint32 timestamp)
    {
        return IDapiServer(dapiServer).readWithDataPointId(dataPointId);
    }

    function exposedReadWithName(bytes32 name)
        external
        view
        returns (int224 value, uint32 timestamp)
    {
        return IDapiServer(dapiServer).readWithName(name);
    }
}