// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title IERC7683
 * @dev Interface for crosschain trade execution systems
 * Based on EIP-7683: https://eips.ethereum.org/EIPS/eip-7683
 */
interface IERC7683 {
    /**
     * @dev GaslessCrossChainOrder struct for orders that are signed off-chain
     */
    struct GaslessCrossChainOrder {
        address originSettler;
        address user;
        uint256 nonce;
        uint256 originChainId;
        uint32 openDeadline;
        uint32 fillDeadline;
        bytes32 orderDataType;
        bytes orderData;
    }

    /**
     * @dev OnchainCrossChainOrder struct for orders that are submitted on-chain
     */
    struct OnchainCrossChainOrder {
        uint32 fillDeadline;
        bytes32 orderDataType;
        bytes orderData;
    }

    /**
     * @dev Output struct defining token transfers as part of the order
     */
    struct Output {
        bytes32 token;
        uint256 amount;
        bytes32 recipient;
        uint256 chainId;
    }

    /**
     * @dev FillInstruction struct providing information for order fulfillment
     */
    struct FillInstruction {
        uint64 destinationChainId;
        bytes32 destinationSettler;
        bytes originData;
    }

    /**
     * @dev ResolvedCrossChainOrder struct providing a generic representation of the order
     */
    struct ResolvedCrossChainOrder {
        address user;
        uint256 originChainId;
        uint32 openDeadline;
        uint32 fillDeadline;
        bytes32 orderId;
        Output[] maxSpent;
        Output[] minReceived;
        FillInstruction[] fillInstructions;
    }

    /**
     * @dev Event emitted when an order is opened
     * @param orderId Unique order identifier
     * @param resolvedOrder Resolved order details
     */
    event Open(bytes32 indexed orderId, ResolvedCrossChainOrder resolvedOrder);

    /**
     * @dev Opens a gasless crosschain order on behalf of a user
     * @param order The gasless order
     * @param signature User's signature over the order
     * @param originFillerData Additional data from the filler
     */
    function openFor(
        GaslessCrossChainOrder calldata order,
        bytes calldata signature,
        bytes calldata originFillerData
    ) external;

    /**
     * @dev Opens a crosschain order directly from the user
     * @param order The on-chain order
     */
    function open(OnchainCrossChainOrder calldata order) external;

    /**
     * @dev Resolves a gasless order into a generic ResolvedCrossChainOrder
     * @param order The gasless order
     * @param originFillerData Additional data from the filler
     * @return Generic representation of the order
     */
    function resolveFor(
        GaslessCrossChainOrder calldata order,
        bytes calldata originFillerData
    ) external view returns (ResolvedCrossChainOrder memory);

    /**
     * @dev Resolves an on-chain order into a generic ResolvedCrossChainOrder
     * @param order The on-chain order
     * @return Generic representation of the order
     */
    function resolve(OnchainCrossChainOrder calldata order)
        external
        view
        returns (ResolvedCrossChainOrder memory);
} 