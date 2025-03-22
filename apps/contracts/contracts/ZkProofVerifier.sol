// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./verifier/Verifier.sol";

/**
 * @title ZkProofVerifier
 * @dev Contract to verify ZK proofs generated from the zk_noir circuits
 */
contract ZkProofVerifier {
    UltraVerifier public verifier;
    
    // Events for tracking proof verifications
    event ProofVerified(address indexed user, uint256 indexed proofType, bool success);
    
    // Proof types
    uint256 public constant PROOF_OF_VISIT = 1;
    uint256 public constant REPUTATION_PROOF = 2;
    uint256 public constant OWNERSHIP_PROOF = 3;
    uint256 public constant TRUSTLESS_COMMITMENT = 4;
    uint256 public constant LOCAL_EXPLORER_BADGE = 5;
    
    /**
     * @dev Constructor sets the verifier contract address
     * @param _verifierAddress Address of the deployed UltraVerifier contract
     */
    constructor(address _verifierAddress) {
        verifier = UltraVerifier(_verifierAddress);
    }
    
    /**
     * @dev Verify a ZK proof
     * @param _proof The proof data
     * @param _publicInputs The public inputs to the proof
     * @param _proofType Type of proof being verified
     * @return True if the proof is valid
     */
    function verifyProof(
        bytes calldata _proof, 
        bytes32[] calldata _publicInputs,
        uint256 _proofType
    ) public returns (bool) {
        bool isValid = verifier.verify(_proof, _publicInputs);
        
        emit ProofVerified(msg.sender, _proofType, isValid);
        
        return isValid;
    }
    
    /**
     * @dev Verify a proof of visit
     * @param _proof The proof data
     * @param _publicInputs The public inputs to the proof
     * @return True if the proof is valid
     */
    function verifyVisit(
        bytes calldata _proof, 
        bytes32[] calldata _publicInputs
    ) public returns (bool) {
        return verifyProof(_proof, _publicInputs, PROOF_OF_VISIT);
    }
    
    /**
     * @dev Verify a reputation proof
     * @param _proof The proof data
     * @param _publicInputs The public inputs to the proof
     * @return True if the proof is valid
     */
    function verifyReputation(
        bytes calldata _proof, 
        bytes32[] calldata _publicInputs
    ) public returns (bool) {
        return verifyProof(_proof, _publicInputs, REPUTATION_PROOF);
    }
    
    /**
     * @dev Verify an ownership proof
     * @param _proof The proof data
     * @param _publicInputs The public inputs to the proof
     * @return True if the proof is valid
     */
    function verifyOwnership(
        bytes calldata _proof, 
        bytes32[] calldata _publicInputs
    ) public returns (bool) {
        return verifyProof(_proof, _publicInputs, OWNERSHIP_PROOF);
    }
    
    /**
     * @dev Verify a trustless commitment proof
     * @param _proof The proof data
     * @param _publicInputs The public inputs to the proof
     * @return True if the proof is valid
     */
    function verifyCommitment(
        bytes calldata _proof, 
        bytes32[] calldata _publicInputs
    ) public returns (bool) {
        return verifyProof(_proof, _publicInputs, TRUSTLESS_COMMITMENT);
    }
    
    /**
     * @dev Verify a local explorer badge proof
     * @param _proof The proof data
     * @param _publicInputs The public inputs to the proof
     * @return True if the proof is valid
     */
    function verifyExplorerBadge(
        bytes calldata _proof, 
        bytes32[] calldata _publicInputs
    ) public returns (bool) {
        return verifyProof(_proof, _publicInputs, LOCAL_EXPLORER_BADGE);
    }
} 