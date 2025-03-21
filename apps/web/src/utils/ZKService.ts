// Initialize Noir and ACVM (Magic Import)
import initNoirC from "@noir-lang/noirc_abi";
import initACVM from "@noir-lang/acvm_js";
import acvm from "@noir-lang/acvm_js/web/acvm_js_bg.wasm?url";
import noirc from "@noir-lang/noirc_abi/web/noirc_abi_wasm_bg.wasm?url";
await Promise.all([initACVM(fetch(acvm)), initNoirC(fetch(noirc))]);
// Real ZK Verification Service using noir_js and bb.js
import { UltraHonkBackend } from '@aztec/bb.js';
import { Noir } from '@noir-lang/noir_js';
import { CompiledCircuit, InputMap as NoirInputMap } from '@noir-lang/types';

// Define the type for proof data
export interface ProofData {
  proof: string;
  publicInputs: string[];
}

// Define the verification data structure expected by the backend
interface VerificationData {
  proof: unknown;
  publicInputs: bigint[];
}

// Our custom InputMap interface that will be converted to noir_js InputMap
interface LocalInputMap {
  [key: string]: bigint | string | boolean | LocalInputMap;
}

// Define the type for proof options
export interface ProofOptions {
  choice: number;
  x: number;
  y: number;
  additionalParams?: Record<string, unknown>;
}

// Cache for compiled circuits
let circuitCache: {
  program?: CompiledCircuit;
  noir?: Noir;
  backend?: UltraHonkBackend;
} = {};

// Initialize noir and backend
async function initializeNoirBackend() {
  if (circuitCache.noir && circuitCache.backend) {
    return circuitCache;
  }

  try {
    console.log('Initializing Noir and UltraHonk backend...');
    
    // Use the public folder path for the circuit files
    const response = await fetch('/circuits/main.json');
    if (!response.ok) {
      throw new Error('Failed to load circuit');
    }
    
    const program = await response.json() as CompiledCircuit;
    const noir = new Noir(program);
    const backend = new UltraHonkBackend(program.bytecode);
    
    // Cache the initialized instances
    circuitCache = { program, noir, backend };
    
    return circuitCache;
  } catch (error) {
    console.error('Error initializing Noir backend:', error);
    throw error;
  }
}

// Convert floating point numbers to integers by multiplying by a factor
function normalizeToInteger(value: number, factor = 1000000): number {
  return Math.round(value * factor);
}

// Convert our LocalInputMap to the noir_js InputMap format
function convertOptionsToInputMap(options: ProofOptions): NoirInputMap {
  try {
    // First create our local input map with bigints
    // Make sure we use integers for all values
    const localInputMap: LocalInputMap = {
      choice: BigInt(options.choice),
      x: BigInt(normalizeToInteger(options.x)),
      y: BigInt(normalizeToInteger(options.y))
    };
    
    if (options.additionalParams) {
      Object.entries(options.additionalParams).forEach(([key, value]) => {
        if (typeof value === 'number') {
          // Ensure number values are integers before converting to BigInt
          localInputMap[key] = BigInt(normalizeToInteger(value));
        } else if (typeof value === 'string' || typeof value === 'boolean') {
          localInputMap[key] = value;
        }
      });
    }
    
    // Convert our LocalInputMap to the format noir_js expects
    // This is a workaround for the type incompatibility
    return localInputMap as unknown as NoirInputMap;
  } catch (error) {
    console.error('Error converting options to InputMap:', error);
    throw new Error(`Failed to convert options: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Real proof generation function
async function generateProof(options: ProofOptions): Promise<ProofData> {
  console.log(`Generating ${getProofTypeName(options.choice)} proof...`);
  
  // Initialize Noir and backend
  const { noir, backend } = await initializeNoirBackend();
  
  if (!noir || !backend) {
    throw new Error('Noir or backend not initialized');
  }
  
  // Convert options to InputMap
  const inputMap = convertOptionsToInputMap(options);
  
  try {
    // Generate witness
    console.log('Generating witness...');
    const { witness } = await noir.execute(inputMap);
    console.log('Generated witness');
    
    // Generate proof
    console.log('Generating proof...');
    const proof = await backend.generateProof(witness);
    console.log('Generated proof');
    
    // Convert proof and public inputs to string format for UI handling
    return {
      proof: JSON.stringify(proof.proof),
      publicInputs: proof.publicInputs.map(input => input.toString())
    };
  } catch (error) {
    console.error('Circuit execution error:', error);
    throw new Error(`Circuit constraint not satisfied: ${error instanceof Error ? error.message : String(error)}`);
  }
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

// Real proof verification function
export async function verifyProof(proof: ProofData): Promise<boolean> {
  console.log(`Verifying proof...`);
  
  // Initialize Noir and backend
  const { backend } = await initializeNoirBackend();
  
  if (!backend) {
    throw new Error('Backend not initialized');
  }
  
  try {
    // Parse proof data and convert inputs to BigInt
    const proofObj = JSON.parse(proof.proof);
    const publicInputs = proof.publicInputs.map(input => BigInt(input));
    
    // Create verification object with the correct typing
    const verificationData: VerificationData = {
      proof: proofObj,
      publicInputs: publicInputs
    };
    
    // Verify proof
    console.log('Verifying proof using UltraHonk backend...');
    // We need to cast to unknown first and then to the expected type
    // This is safer than using 'any' directly
    const isValid = await backend.verifyProof(verificationData as unknown as Parameters<typeof backend.verifyProof>[0]);
    console.log(`Proof is ${isValid ? 'valid' : 'invalid'}`);
    
    return isValid;
  } catch (error) {
    console.error('Verification error:', error);
    throw new Error(`Verification failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Hash functions that correspond to Noir implementations
function hashLocation(latitude: number, longitude: number): number {
  // Convert to integers by multiplying by 1,000,000 (similar to the Noir code)
  const lat = normalizeToInteger(latitude);
  const lng = normalizeToInteger(longitude);
  
  // Simple hash function for demo - in production would match the Noir hash_location function
  // We just do a simple combination for demonstration
  return Math.abs(lat + lng);
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
  // Calculate location hash using the same method as in proof_of_visit.nr
  const locationHash = hashLocation(latitude, longitude);
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const maxTimeDiff = 86400; // 24 hours in seconds
  
  // Based on proof_of_visit.nr, we need these parameters:
  // - location_hash (the hash of the actual location)
  // - user_location_hash (the user's claimed location hash, same as above)
  // - visit_timestamp (when the user visited)
  // - current_timestamp (current time)
  // - max_time_diff (maximum allowed time difference)
  
  // In main.nr, the constraint for Proof of Visit is just assert(x != 0)
  if (locationHash === 0) {
    throw new Error('zkErrors.locationHash');
  }
  
  // Check if visit time is within allowed range
  const timeDiff = currentTimestamp - visitTimestamp;
  if (timeDiff < 0 || timeDiff > maxTimeDiff) {
    throw new Error('zkErrors.visitTime');
  }
  
  console.log(`Generating Proof of Visit with location hash ${locationHash} and timestamp ${visitTimestamp}`);
  
  // For the simplified circuit, we just pass the location hash as x
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
  // Based on reputation_proofs.nr:
  // fn prove_reputation_above_threshold(actual_score: Field, threshold: Field)
  // We need to prove that actual_score >= threshold
  
  if (actualScore < threshold) {
    throw new Error('zkErrors.reputation');
  }
  
  console.log(`Generating Reputation Proof with score ${actualScore} against threshold ${threshold}`);
  
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
  // Based on ownership_proofs.nr:
  // fn prove_token_balance(actual_balance: Field, min_required: Field)
  // We need to prove that actual_balance >= min_required
  
  if (tokenBalance === 0) {
    throw new Error('zkErrors.tokenBalance');
  }
  
  if (tokenBalance < minRequired) {
    throw new Error('zkErrors.tokenBalance'); // Use the same error key for simplicity
  }
  
  console.log(`Generating Ownership Proof with token balance ${tokenBalance} and minimum required ${minRequired}`);
  
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
  // Based on trustless_commitments.nr
  // We're creating a commitment for a task with a deadline
  
  const commitmentHash = hashTask(taskDescription);
  const currentTime = Math.floor(Date.now() / 1000);
  
  if (commitmentHash === 0) {
    throw new Error('zkErrors.commitment');
  }
  
  // Check if deadline is in the future
  if (deadline <= currentTime) {
    throw new Error('zkErrors.deadline');
  }
  
  console.log(`Generating Commitment Proof with hash ${commitmentHash} and deadline ${deadline}`);
  
  return generateProof({
    choice: 4,
    x: commitmentHash,
    y: deadline,
    additionalParams: {
      currentTime
    }
  });
}

// Generate Explorer Badge Proof
export async function generateExplorerBadgeProof(
  jwtToken: string, 
  requiredVisits: number
): Promise<ProofData> {
  // Based on local_explorer_badge.nr
  // We're proving that a JWT contains a claim showing the user has visited enough places
  
  // For the demo, we'll use the JWT token length as a simple proxy for the real JWT verification
  const tokenValue = jwtToken.length;
  
  if (tokenValue === 0) {
    throw new Error('zkErrors.jwt');
  }
  
  // In a real implementation, we'd verify the JWT and check the visited_places claim
  // Here we just ensure the token is non-empty and requiredVisits is reasonable
  if (requiredVisits <= 0) {
    throw new Error('zkErrors.requiredVisits');
  }
  
  console.log(`Generating Explorer Badge Proof with token value ${tokenValue} and required visits ${requiredVisits}`);
  
  return generateProof({
    choice: 5,
    x: tokenValue,
    y: requiredVisits
  });
} 