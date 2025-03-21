// Mock ZK Verification Service
// This is a simplified implementation for the hackathon demo

// Define the type for proof data
export interface ProofData {
  proof: string;
  publicInputs: string[];
}

// Define the type for proof options
export interface ProofOptions {
  choice: number;
  x: number;
  y: number;
  additionalParams?: Record<string, unknown>;
}

// A simple delay function to simulate computation time
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Mock proof generation function
async function generateProof(options: ProofOptions): Promise<ProofData> {
  console.log(`Generating ${getProofTypeName(options.choice)} proof...`);
  
  // Simulate computation time
  await delay(1500 + Math.random() * 1000);
  
  return {
    proof: `mock_proof_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
    publicInputs: [options.x.toString(), options.y.toString()]
  };
}

// Get the proof type name for logging
function getProofTypeName(choice: number): string {
  switch (choice) {
    case 1: return 'Proof of Visit';
    case 2: return 'Reputation Proof';
    case 3: return 'Ownership Proof';
    case 4: return 'Commitment Proof';
    case 5: return 'Explorer Badge Proof';
    default: return 'Unknown Proof';
  }
}

// Mock proof verification function
export async function verifyProof(proof: ProofData): Promise<boolean> {
  console.log(`Verifying proof: ${proof.proof.substring(0, 20)}...`);
  
  // Simulate verification time
  await delay(1000 + Math.random() * 500);
  
  // 80% success rate for demo purposes
  return Math.random() > 0.2;
}

// Hash functions that correspond to Noir implementations
function hashLocation(latitude: number, longitude: number): number {
  // Simple hash function for demo - in production would use a real hash function
  return Math.abs(latitude * 1000000 + longitude * 1000);
}

function hashTask(description: string): number {
  // Simple hash function for demo
  let hash = 0;
  for (let i = 0; i < description.length; i++) {
    hash = ((hash << 5) - hash) + description.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

// Generate Proof of Visit
export async function generateProofOfVisit(
  latitude: number, 
  longitude: number, 
  visitTimestamp: number
): Promise<ProofData> {
  const locationHash = hashLocation(latitude, longitude);
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const maxTimeDiff = 86400; // 24 hours in seconds
  
  return generateProof({
    choice: 1,
    x: locationHash,
    y: visitTimestamp,
    additionalParams: {
      currentTimestamp,
      maxTimeDiff
    }
  });
}

// Generate Reputation Proof
export async function generateReputationProof(
  actualScore: number, 
  threshold: number
): Promise<ProofData> {
  return generateProof({
    choice: 2,
    x: actualScore,
    y: threshold
  });
}

// Generate Ownership Proof
export async function generateOwnershipProof(
  tokenBalance: number, 
  minRequired: number
): Promise<ProofData> {
  return generateProof({
    choice: 3,
    x: tokenBalance,
    y: minRequired
  });
}

// Generate Commitment Proof
export async function generateCommitmentProof(
  taskDescription: string, 
  deadline: number
): Promise<ProofData> {
  const commitmentHash = hashTask(taskDescription);
  
  return generateProof({
    choice: 4,
    x: commitmentHash,
    y: deadline,
    additionalParams: {
      currentTime: Math.floor(Date.now() / 1000)
    }
  });
}

// Generate Explorer Badge Proof
export async function generateExplorerBadgeProof(
  jwtToken: string, 
  requiredVisits: number
): Promise<ProofData> {
  // In a real implementation, we would process the JWT here
  // For now, we just use a mock implementation
  
  return generateProof({
    choice: 5,
    x: jwtToken.length, // Just using the token length for the mock
    y: requiredVisits
  });
} 