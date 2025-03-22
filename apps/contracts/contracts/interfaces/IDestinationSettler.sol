// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title IDestinationSettler
 * @dev Interface for settlement contracts on the destination chain
 * Based on EIP-7683: https://eips.ethereum.org/EIPS/eip-7683
 */
interface IDestinationSettler {
    /**
     * @dev Fills a single leg of a particular order on the destination chain
     * @param orderId Unique order identifier for this order
     * @param originData Data emitted on the origin to parameterize the fill
     * @param fillerData Data provided by the filler to inform the fill or express their preferences
     */
    function fill(
        bytes32 orderId,
        bytes calldata originData,
        bytes calldata fillerData
    ) external;
} 