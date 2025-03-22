// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./interfaces/IERC7683.sol";

/**
 * @title L1POIMarketplace
 * @dev L1 contract for trusted POI (Point of Interest) marketplace
 * Manages POI registration, verification, and reward distribution
 * Uses ERC-7683 for cross-chain communication with L2 for bidding and verification
 */
contract L1POIMarketplace is IERC7683 {
    // POI struct to store the point of interest data
    struct POI {
        string name;
        address owner;
        uint256 stakeAmount;
        bool verified;
        address validator;
        bytes proof;
        uint256 timestamp;
        bool challenged;
        uint256 challengeEndTime;
        VerificationState state;
    }

    // Verification state of a POI
    enum VerificationState {
        Pending,
        Verifying,
        Verified,
        Challenged,
        Rejected
    }

    // Order struct for cross-chain communication
    struct CrossChainOrder {
        address originSettler;
        address user;
        uint256 nonce;
        uint256 originChainId;
        uint32 openDeadline;
        uint32 fillDeadline;
        bytes32 orderDataType;
        bytes orderData;
    }

    // POI verification request data
    struct POIVerificationData {
        uint256 poiId;
        string name;
        address owner;
        uint256 stakeAmount;
        uint256 bidStartAmount;
    }

    // L2 destination contract address
    address public l2DestinationContract;
    // Chain ID for L2
    uint256 public l2ChainId;
    // Total POIs registered
    uint256 public totalPOIs;
    // Challenge duration in seconds
    uint256 public challengeDuration = 3 days;
    // Reward percentage for validators (30%)
    uint256 public validatorRewardPercentage = 30;
    // Owner of the contract
    address public owner;
    
    // Mapping from POI ID to POI data
    mapping(uint256 => POI) public pois;
    // Mapping from order ID to POI ID
    mapping(bytes32 => uint256) public orderToPoi;
    // Mapping from nonce to whether it's used
    mapping(uint256 => bool) public usedNonces;
    
    // Events
    event POIRegistered(uint256 indexed poiId, string name, address indexed owner, uint256 stakeAmount);
    event POIVerificationRequested(uint256 indexed poiId, bytes32 indexed orderId);
    event POIVerified(uint256 indexed poiId, address indexed validator, bytes proof);
    event POIChallenged(uint256 indexed poiId, address challenger);
    event POIRejected(uint256 indexed poiId);
    event POIChallengeResolved(uint256 indexed poiId, bool verified);
    event RewardDistributed(uint256 indexed poiId, address indexed validator, uint256 amount);
    event L2ContractUpdated(address indexed oldContract, address indexed newContract);

    // Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    /**
     * @dev Constructor to set L2 contract details
     * @param _l2DestinationContract Address of L2 contract for POI verification
     * @param _l2ChainId Chain ID of L2
     */
    constructor(address _l2DestinationContract, uint256 _l2ChainId) {
        l2DestinationContract = _l2DestinationContract;
        l2ChainId = _l2ChainId;
        owner = msg.sender;
    }

    /**
     * @dev Update the L2 destination contract address
     * @param _l2DestinationContract New L2 contract address
     */
    function updateL2Contract(address _l2DestinationContract) external onlyOwner {
        address oldContract = l2DestinationContract;
        l2DestinationContract = _l2DestinationContract;
        emit L2ContractUpdated(oldContract, _l2DestinationContract);
    }

    /**
     * @dev Register a new POI and request verification
     * @param name Name of the POI
     * @param stakeAmount Amount staked to guarantee authenticity
     */
    function registerPOI(string memory name, uint256 stakeAmount) external payable {
        require(msg.value >= stakeAmount, "Insufficient stake amount");
        require(bytes(name).length > 0, "Name cannot be empty");
        
        uint256 poiId = totalPOIs++;
        
        // Create POI record
        pois[poiId] = POI({
            name: name,
            owner: msg.sender,
            stakeAmount: stakeAmount,
            verified: false,
            validator: address(0),
            proof: new bytes(0),
            timestamp: block.timestamp,
            challenged: false,
            challengeEndTime: 0,
            state: VerificationState.Pending
        });
        
        emit POIRegistered(poiId, name, msg.sender, stakeAmount);
        
        // Request verification on L2
        _requestL2Verification(poiId, stakeAmount);
    }

    /**
     * @dev Resolve POI verification with proof from L2
     * @param poiId ID of the POI
     * @param validator Address of the validator who verified the POI
     * @param proof ZK proof of the POI verification
     */
    function resolvePOI(uint256 poiId, address validator, bytes memory proof) external {
        POI storage poi = pois[poiId];
        require(poi.state == VerificationState.Verifying, "POI not in verifying state");
        require(poi.owner != address(0), "POI does not exist");
        require(!poi.verified, "POI already verified");
        
        // Verify the proof (in production, this would validate ZK proof)
        // For simplicity, we're just accepting the proof without verification
        poi.verified = true;
        poi.validator = validator;
        poi.proof = proof;
        poi.state = VerificationState.Verified;
        
        // Distribute rewards to validator (30% of stake)
        uint256 validatorReward = (poi.stakeAmount * validatorRewardPercentage) / 100;
        payable(validator).transfer(validatorReward);
        
        emit POIVerified(poiId, validator, proof);
        emit RewardDistributed(poiId, validator, validatorReward);
    }

    /**
     * @dev Challenge a verified POI
     * @param poiId ID of the POI to challenge
     */
    function challengePOI(uint256 poiId) external payable {
        require(msg.value >= 0.1 ether, "Challenge requires 0.1 ETH deposit");
        
        POI storage poi = pois[poiId];
        require(poi.state == VerificationState.Verified, "POI not verified");
        require(!poi.challenged, "POI already challenged");
        
        poi.challenged = true;
        poi.challengeEndTime = block.timestamp + challengeDuration;
        poi.state = VerificationState.Challenged;
        
        emit POIChallenged(poiId, msg.sender);
        
        // In a real implementation, this would trigger additional verification
        // through TEE or other means
    }

    /**
     * @dev Resolve a challenge after the challenge period
     * @param poiId ID of the challenged POI
     * @param verified Whether the challenge was successful (POI is verified)
     */
    function resolvePOIChallenge(uint256 poiId, bool verified) external {
        POI storage poi = pois[poiId];
        require(poi.state == VerificationState.Challenged, "POI not challenged");
        require(block.timestamp > poi.challengeEndTime, "Challenge period not over");
        
        if (verified) {
            poi.state = VerificationState.Verified;
            poi.challenged = false;
        } else {
            poi.state = VerificationState.Rejected;
            poi.verified = false;
            
            // Refund the owner's stake (minus validator reward)
            uint256 validatorReward = (poi.stakeAmount * validatorRewardPercentage) / 100;
            uint256 refundAmount = poi.stakeAmount - validatorReward;
            payable(poi.owner).transfer(refundAmount);
            
            emit POIRejected(poiId);
        }
        
        emit POIChallengeResolved(poiId, verified);
    }

    /**
     * @dev Get details of a POI
     * @param poiId ID of the POI
     * @return POI data
     */
    function getPOI(uint256 poiId) external view returns (POI memory) {
        return pois[poiId];
    }

    /**
     * @dev Internal function to request verification on L2
     * @param poiId ID of the POI
     * @param stakeAmount Amount staked for the POI
     */
    function _requestL2Verification(uint256 poiId, uint256 stakeAmount) internal {
        // Create verification request data
        POIVerificationData memory verificationData = POIVerificationData({
            poiId: poiId,
            name: pois[poiId].name,
            owner: pois[poiId].owner,
            stakeAmount: stakeAmount,
            bidStartAmount: stakeAmount / 10 // Starting bid is 10% of stake
        });
        
        // Generate a unique nonce
        uint256 nonce = uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender, poiId)));
        require(!usedNonces[nonce], "Nonce already used");
        usedNonces[nonce] = true;
        
        // Create cross-chain order for L2
        GaslessCrossChainOrder memory order = GaslessCrossChainOrder({
            originSettler: address(this),
            user: msg.sender,
            nonce: nonce,
            originChainId: block.chainid,
            openDeadline: uint32(block.timestamp + 1 days),
            fillDeadline: uint32(block.timestamp + 3 days),
            orderDataType: keccak256("POIVerification"),
            orderData: abi.encode(verificationData)
        });
        
        // Generate order ID
        bytes32 orderId = keccak256(abi.encode(order));
        orderToPoi[orderId] = poiId;
        
        // Update POI state
        pois[poiId].state = VerificationState.Verifying;
        
        // Emit event for L2 to pick up
        emit Open(orderId, _resolveOrder(order));
        emit POIVerificationRequested(poiId, orderId);
    }

    /**
     * @dev Implementation of ERC-7683 openFor function
     * @param order Order details
     * @param signature Signature of the user
     * @param originFillerData Additional data from filler
     */
    function openFor(
        GaslessCrossChainOrder calldata order,
        bytes calldata signature,
        bytes calldata originFillerData
    ) external override {
        // In a real implementation, this would verify the signature
        // and handle the token transfers

        // Generate order ID
        bytes32 orderId = keccak256(abi.encode(order));
        
        // Resolve the order into a format that fillers can understand
        ResolvedCrossChainOrder memory resolvedOrder = _resolveOrder(order);
        
        // Emit the Open event as required by ERC-7683
        emit Open(orderId, resolvedOrder);
    }

    /**
     * @dev Implementation of ERC-7683 open function
     * @param order Order details
     */
    function open(OnchainCrossChainOrder calldata order) external override {
        // This would be implemented for on-chain orders
        // For our POI marketplace, we use the gasless approach
        revert("On-chain orders not supported for POI marketplace");
    }

    /**
     * @dev Implementation of ERC-7683 resolveFor function
     * @param order Order details
     * @param originFillerData Additional data from filler
     * @return resolvedOrder Resolved cross-chain order
     */
    function resolveFor(
        GaslessCrossChainOrder calldata order,
        bytes calldata originFillerData
    ) external view override returns (ResolvedCrossChainOrder memory) {
        return _resolveOrder(order);
    }

    /**
     * @dev Implementation of ERC-7683 resolve function
     * @param order Order details
     * @return resolvedOrder Resolved cross-chain order
     */
    function resolve(OnchainCrossChainOrder calldata order) external view override returns (ResolvedCrossChainOrder memory) {
        // This would be implemented for on-chain orders
        // For our POI marketplace, we use the gasless approach
        revert("On-chain orders not supported for POI marketplace");
    }

    /**
     * @dev Internal function to resolve an order into the ERC-7683 format
     * @param order Order details
     * @return resolvedOrder Resolved cross-chain order
     */
    function _resolveOrder(GaslessCrossChainOrder memory order) internal view returns (ResolvedCrossChainOrder memory) {
        // Decode the order data
        POIVerificationData memory verificationData = abi.decode(order.orderData, (POIVerificationData));
        
        // Create fill instructions for the destination chain
        FillInstruction[] memory fillInstructions = new FillInstruction[](1);
        fillInstructions[0] = FillInstruction({
            destinationChainId: uint64(l2ChainId),
            destinationSettler: bytes32(uint256(uint160(l2DestinationContract))),
            originData: abi.encode(verificationData, order.user, order.nonce)
        });
        
        // Create output for the user
        Output[] memory maxSpent = new Output[](1);
        maxSpent[0] = Output({
            token: bytes32(uint256(0)), // Native token
            amount: verificationData.stakeAmount,
            recipient: bytes32(uint256(uint160(address(this)))),
            chainId: block.chainid
        });
        
        // Create output for the validator
        Output[] memory minReceived = new Output[](1);
        minReceived[0] = Output({
            token: bytes32(uint256(0)), // Native token
            amount: verificationData.bidStartAmount,
            recipient: bytes32(uint256(uint160(order.user))),
            chainId: l2ChainId
        });
        
        // Create the resolved order
        return ResolvedCrossChainOrder({
            user: order.user,
            originChainId: order.originChainId,
            openDeadline: order.openDeadline,
            fillDeadline: order.fillDeadline,
            orderId: keccak256(abi.encode(order)),
            maxSpent: maxSpent,
            minReceived: minReceived,
            fillInstructions: fillInstructions
        });
    }
} 