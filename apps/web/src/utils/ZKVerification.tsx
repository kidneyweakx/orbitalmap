switch (verificationType) {
  case VerificationType.PROOF_OF_VISIT:
    proof = await generateProofOfVisit(
      parseFloat(formData.latitude),
      parseFloat(formData.longitude),
      parseInt(formData.visitTimestamp)
    );
    break;
  case VerificationType.REPUTATION:
    // Convert inputs to numbers but ensure they're small integers
    proof = await generateReputationProof(
      Math.min(parseInt(formData.actualScore), 100),
      Math.min(parseInt(formData.threshold), 100)
    );
    break;
  case VerificationType.OWNERSHIP:
    proof = await generateOwnershipProof(
      Math.min(parseInt(formData.tokenBalance), 100),
      Math.min(parseInt(formData.minRequired), 100)
    );
    break;
  case VerificationType.COMMITMENT:
    proof = await generateCommitmentProof(
      formData.taskDescription,
      parseInt(formData.deadline)
    );
    break;
  case VerificationType.EXPLORER_BADGE:
    proof = await generateExplorerBadgeProof(
      formData.jwtToken,
      Math.min(parseInt(formData.requiredVisits), 100)
    );
    break;
} 