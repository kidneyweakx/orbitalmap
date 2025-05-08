// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./interfaces/IDestinationSettler.sol";
import "./verifier/Verifier.sol";

/**
 * @title L2POIAuction
 * @dev L2 contract for POI (Point of Interest) auction and validation
 * Handles auction process for validators to compete for POI verification
 * Uses TEE+ZK for reliable verification
 * Implements IDestinationSettler for cross-chain communication
 */
contract L2POIAuction is IDestinationSettler {
    // POI verification request
    struct POIVerificationRequest {
        uint256 poiId;
        string name;
        address owner;
        uint256 stakeAmount;
        uint256 bidStartAmount;
        uint256 auctionEndTime;
        address winningValidator;
        uint256 winningBid;
        bool auctionEnded;
        bool verified;
        bytes zkProof;
        bytes32 orderId;
        address[] validators;
        mapping(address => uint256) bids;
    }
    
    // Represents a validator credential
    struct ValidatorCredential {
        bool isRegistered;
        uint256 totalVerified;
        uint256 reputation;
        uint256 stakedAmount;
    }

    // L1 origin contract address
    address public l1OriginContract;
    // L1 chain ID
    uint256 public l1ChainId;
    // Auction duration in seconds
    uint256 public auctionDuration = 1 days;
    // Minimum reputation required to be a validator
    uint256 public minValidatorReputation = 100;
    // Minimum stake amount required to be a validator
    uint256 public minValidatorStake = 0.5 ether;
    
    // Mapping from POI ID to verification request
    mapping(uint256 => POIVerificationRequest) private poiRequests;
    // Mapping from order ID to POI ID
    mapping(bytes32 => uint256) public orderToPoi;
    // Mapping from validator address to credential
    mapping(address => ValidatorCredential) public validators;
    // Total validators in the system
    uint256 public totalValidators;
    
    // Events
    event ValidatorRegistered(address indexed validator, uint256 stakedAmount);
    event AuctionStarted(uint256 indexed poiId, bytes32 indexed orderId, uint256 bidStartAmount, uint256 auctionEndTime);
    event BidPlaced(uint256 indexed poiId, address indexed validator, uint256 bidAmount);
    event AuctionEnded(uint256 indexed poiId, address indexed winningValidator, uint256 winningBid);
    event ProofSubmitted(uint256 indexed poiId, address indexed validator, bytes zkProof);
    event VerificationCompleted(uint256 indexed poiId, address indexed validator, bytes zkProof);
    event CrossChainResultSubmitted(uint256 indexed poiId, bytes32 indexed orderId, address indexed validator);

    // Verifier contract instance
    IVerifier public verifier;

    /**
     * @dev Constructor to set L1 contract details
     * @param _l1OriginContract Address of L1 contract for POI marketplace
     * @param _l1ChainId Chain ID of L1
     * @param _verifier Address of the Verifier contract
     */
    constructor(address _l1OriginContract, uint256 _l1ChainId, address _verifier) {
        l1OriginContract = _l1OriginContract;
        l1ChainId = _l1ChainId;
        verifier = IVerifier(_verifier);
    }

    /**
     * @dev Register as a validator
     * @param reputationProof Optional proof of reputation (could be ZK proof)
     */
    function registerValidator(bytes calldata reputationProof) external payable {
        require(msg.value >= minValidatorStake, "Insufficient stake amount");
        require(!validators[msg.sender].isRegistered, "Already registered as validator");
        
        // In production, would validate reputation proof through ZK verification
        uint256 reputation = reputationProof.length > 0 ? 200 : 100; // Simplified logic
        
        validators[msg.sender] = ValidatorCredential({
            isRegistered: true,
            totalVerified: 0,
            reputation: reputation,
            stakedAmount: msg.value
        });
        
        totalValidators++;
        
        emit ValidatorRegistered(msg.sender, msg.value);
    }

    /**
     * @dev Implementation of IDestinationSettler fill function
     * Starts the POI verification auction
     * @param orderId Unique order identifier
     * @param originData Data from the origin chain
     * @param fillerData Additional data from the filler
     */
    function fill(
        bytes32 orderId,
        bytes calldata originData,
        bytes calldata fillerData
    ) external override {
        // Decode the origin data
        (
            L1POIMarketplace.POIVerificationData memory verificationData,
            address user,
            uint256 nonce
        ) = abi.decode(originData, (L1POIMarketplace.POIVerificationData, address, uint256));
        
        uint256 poiId = verificationData.poiId;
        
        // Store the mapping from order ID to POI ID
        orderToPoi[orderId] = poiId;
        
        // Initialize auction for this POI
        _initializeAuction(poiId, orderId, verificationData, user);
    }

    /**
     * @dev Place a bid in a POI verification auction
     * @param poiId ID of the POI
     * @param bidAmount Amount to bid
     */
    function placeBid(uint256 poiId, uint256 bidAmount) external {
        require(validators[msg.sender].isRegistered, "Not a registered validator");
        require(validators[msg.sender].reputation >= minValidatorReputation, "Insufficient reputation");
        
        POIVerificationRequest storage request = poiRequests[poiId];
        require(block.timestamp < request.auctionEndTime, "Auction ended");
        require(bidAmount > request.winningBid, "Bid too low");
        
        // Update bid
        request.bids[msg.sender] = bidAmount;
        
        // If this is the first bid from this validator, add to the validators array
        bool isNewValidator = true;
        for (uint i = 0; i < request.validators.length; i++) {
            if (request.validators[i] == msg.sender) {
                isNewValidator = false;
                break;
            }
        }
        
        if (isNewValidator) {
            request.validators.push(msg.sender);
        }
        
        // Update winning bid
        if (bidAmount > request.winningBid) {
            request.winningBid = bidAmount;
            request.winningValidator = msg.sender;
        }
        
        emit BidPlaced(poiId, msg.sender, bidAmount);
    }

    /**
     * @dev End the auction for a POI
     * @param poiId ID of the POI
     */
    function endAuction(uint256 poiId) external {
        POIVerificationRequest storage request = poiRequests[poiId];
        require(block.timestamp >= request.auctionEndTime, "Auction not ended yet");
        require(!request.auctionEnded, "Auction already ended");
        
        request.auctionEnded = true;
        
        emit AuctionEnded(poiId, request.winningValidator, request.winningBid);
    }

    /**
     * @dev Submit POI verification proof
     * @param poiId ID of the POI
     * @param zkProof ZK proof of POI verification
     * @param publicInputs Public inputs for the proof
     */
    function submitPOIProof(uint256 poiId, bytes memory zkProof, bytes32[] memory publicInputs) external {
        POIVerificationRequest storage request = poiRequests[poiId];
        require(request.auctionEnded, "Auction not ended");
        require(msg.sender == request.winningValidator, "Not the winning validator");
        require(!request.verified, "Proof already submitted");
        
        // In production, would verify the ZK proof
        // For simplicity, accept any proof submission
        // Verify the ZK proof
        bool isValid = verifier.verify(zkProof, publicInputs);
        require(isValid, "Invalid ZK proof");
        
        request.verified = true;
        request.zkProof = zkProof;
        
        // Update validator stats
        validators[msg.sender].totalVerified++;
        validators[msg.sender].reputation += 10; // Reward for successful verification
        
        emit ProofSubmitted(poiId, msg.sender, zkProof);
        
        // Submit the result back to L1
        _submitResultToL1(poiId);
    }

    /**
     * @dev Get the winning bid for a POI
     * @param poiId ID of the POI
     * @return winningValidator Address of the winning validator
     * @return winningBid Amount of the winning bid
     */
    function getWinningBid(uint256 poiId) external view returns (address, uint256) {
        POIVerificationRequest storage request = poiRequests[poiId];
        return (request.winningValidator, request.winningBid);
    }

    /**
     * @dev Get auction details for a POI
     * @param poiId ID of the POI
     * @return name Name of the POI
     * @return auctionEndTime End time of the auction
     * @return winningValidator Current winning validator
     * @return winningBid Current winning bid
     * @return auctionEnded Whether the auction has ended
     * @return verified Whether the POI has been verified
     */
    function getAuctionDetails(uint256 poiId) external view returns (
        string memory name,
        uint256 auctionEndTime,
        address winningValidator,
        uint256 winningBid,
        bool auctionEnded,
        bool verified
    ) {
        POIVerificationRequest storage request = poiRequests[poiId];
        return (
            request.name,
            request.auctionEndTime,
            request.winningValidator,
            request.winningBid,
            request.auctionEnded,
            request.verified
        );
    }

    /**
     * @dev Internal function to initialize auction for a POI
     * @param poiId ID of the POI
     * @param orderId Unique order identifier
     * @param verificationData POI verification data from L1
     * @param user Address of the POI owner
     */
    function _initializeAuction(
        uint256 poiId,
        bytes32 orderId,
        L1POIMarketplace.POIVerificationData memory verificationData,
        address user
    ) internal {
        POIVerificationRequest storage request = poiRequests[poiId];
        
        // Initialize the POI request
        request.poiId = poiId;
        request.name = verificationData.name;
        request.owner = user;
        request.stakeAmount = verificationData.stakeAmount;
        request.bidStartAmount = verificationData.bidStartAmount;
        request.auctionEndTime = block.timestamp + auctionDuration;
        request.winningBid = verificationData.bidStartAmount - 1; // Set just below starting bid
        request.orderId = orderId;
        
        emit AuctionStarted(poiId, orderId, verificationData.bidStartAmount, request.auctionEndTime);
    }

    /**
     * @dev Internal function to submit verification result back to L1
     * @param poiId ID of the POI
     */
    function _submitResultToL1(uint256 poiId) internal {
        POIVerificationRequest storage request = poiRequests[poiId];
        
        // In a real implementation, this would call a cross-chain messaging protocol
        // to send the verification result back to L1
        // For the purpose of this design, we'll emit an event that can be monitored
        
        emit VerificationCompleted(poiId, request.winningValidator, request.zkProof);
        emit CrossChainResultSubmitted(poiId, request.orderId, request.winningValidator);
        
        // In production, would use a cross-chain messaging protocol like LayerZero, Axelar, etc.
        // e.g.: ILayerZeroEndpoint(lzEndpoint).send(
        //     l1ChainId,
        //     abi.encodePacked(l1OriginContract),
        //     abi.encode(poiId, request.winningValidator, request.zkProof),
        //     payable(msg.sender),
        //     address(0),
        //     bytes("")
        // );
    }
}

// Helper interface to reference L1 contract structures
interface L1POIMarketplace {
    struct POIVerificationData {
        uint256 poiId;
        string name;
        address owner;
        uint256 stakeAmount;
        uint256 bidStartAmount;
    }
} 