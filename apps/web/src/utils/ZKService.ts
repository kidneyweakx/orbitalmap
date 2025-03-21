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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  proof: any; // Use any to avoid type conflicts
  publicInputs: string[];
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

// Convert our options to the noir_js InputMap format
function convertOptionsToInputMap(options: ProofOptions): NoirInputMap {
  try {
    console.log('Converting options to InputMap:', JSON.stringify(options));
    
    // Create input map with strings
    const localInputMap: Record<string, unknown> = {
      // Convert all values to simple strings
      choice: options.choice.toString(),
      x: options.x.toString(),
      y: options.y.toString()
    };
    
    // If choice is 2 (Reputation Proof), we must ensure x >= y
    if (options.choice === 2 && options.x < options.y) {
      throw new Error('zkErrors.reputation');
    }
    
    // If choice is 1, 3, 4, or 5, we must ensure x != 0
    if ([1, 3, 4, 5].includes(options.choice) && options.x === 0) {
      // Throw appropriate error based on choice
      if (options.choice === 1) throw new Error('zkErrors.locationHash');
      if (options.choice === 3) throw new Error('zkErrors.tokenBalance');
      if (options.choice === 4) throw new Error('zkErrors.commitment');
      if (options.choice === 5) throw new Error('zkErrors.jwt');
    }
    
    if (options.additionalParams) {
      Object.entries(options.additionalParams).forEach(([key, value]) => {
        // Convert all values to strings
        localInputMap[key] = value?.toString() || '';
      });
    }
    
    console.log('Debug: Input map (string format):', JSON.stringify(localInputMap));
    
    // Convert our map to the format noir_js expects
    return localInputMap as unknown as NoirInputMap;
  } catch (error) {
    console.error('Error converting options to InputMap:', error);
    throw error;
  }
}

// Real proof generation function
async function generateProof(options: ProofOptions): Promise<ProofData> {
  console.log(`Generating ${getProofTypeName(options.choice)} proof...`);
  console.log('Raw options:', JSON.stringify(options));
  
  // Initialize Noir and backend
  const { noir, backend } = await initializeNoirBackend();
  
  if (!noir || !backend) {
    throw new Error('Noir or backend not initialized');
  }
  
  // Convert options to InputMap
  const inputMap = convertOptionsToInputMap(options);
  
  try {
    // Generate witness
    console.log('Generating witness with inputs:', JSON.stringify({
      choice: options.choice,
      x: options.x,
      y: options.y
    }));
    console.log('Input map for circuit:', JSON.stringify({
      choice: Number(BigInt(options.choice)),
      x: Number(BigInt(options.x)),
      y: Number(BigInt(options.y))
    }));
    
    const { witness } = await noir.execute(inputMap);
    console.log('Generated witness successfully');
    
    // Generate proof
    console.log('Generating proof...');
    const proof = await backend.generateProof(witness);
    console.log('Generated proof successfully');
    
    // Return the proof directly without stringifying
    return {
      proof: proof.proof,
      publicInputs: proof.publicInputs.map(input => input.toString())
    };
  } catch (error) {
    console.error('Circuit execution error:', error);
    
    // Check for specific errors
    const errorStr = String(error);
    if (errorStr.includes('unwrap_throw')) {
      console.error('Circuit constraints not satisfied. Check that:');
      console.error(`- For choice 1,3,4,5: x must not be 0`);
      console.error(`- For choice 2: x must be >= y`);
      
      // Log the actual values
      console.error(`Current values: choice=${options.choice}, x=${options.x}, y=${options.y}`);
      
      throw new Error(`zkErrors.unwrap_throw`);
    }
    
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
    // Convert public inputs to BigInt
    const publicInputs = proof.publicInputs.map(input => BigInt(input));
    
    // Create verification data object
    const verificationData = {
      proof: proof.proof,
      publicInputs: publicInputs
    };
    
    // Verify proof
    console.log('Verifying proof using UltraHonk backend...');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isValid = await backend.verifyProof(verificationData as any);
    console.log(`Proof is ${isValid ? 'valid' : 'invalid'}`);
    
    return isValid;
  } catch (error) {
    console.error('Verification error:', error);
    throw new Error(`Verification failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Hash functions that correspond to Noir implementations
function hashLocation(latitude: number, longitude: number): number {
  // Simple hash function for demo - in production would match the Noir hash_location function
  // Use modest integers that the circuit can handle
  const lat = Math.round(latitude * 100);
  const lng = Math.round(longitude * 100);
  
  // Make sure we don't return 0 (circuit constraint)
  return Math.max(1, Math.abs(lat + lng));
}

function hashTask(description: string): number {
  // Simple hash function for demo
  let hash = 0;
  for (let i = 0; i < description.length; i++) {
    hash = ((hash << 5) - hash) + description.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  // Make sure we don't return 0 or extremely large values
  // Modulo to keep it in a reasonable range and add 1 to ensure non-zero
  return (Math.abs(hash) % 1000) + 1;
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
  
  // From main.nr, the constraint for Proof of Visit is: assert(x != 0)
  // Where x is the location hash
  if (locationHash === 0) {
    throw new Error('zkErrors.locationHash');
  }
  
  // Check if visit time is within allowed range
  const timeDiff = currentTimestamp - visitTimestamp;
  if (timeDiff < 0 || timeDiff > maxTimeDiff) {
    throw new Error('zkErrors.visitTime');
  }
  
  console.log(`Generating Proof of Visit with location hash ${locationHash} and timestamp ${visitTimestamp}`);
  
  // Use integers directly
  return generateProof({
    choice: 1,
    x: locationHash,
    y: Math.round(visitTimestamp),
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
  // From main.nr, the constraint for Reputation Proof is:
  // assert((x as i64) >= (y as i64));
  // Where x is actual_score and y is threshold
  
  // Validate inputs - ensure positive values
  if (actualScore <= 0) {
    throw new Error('zkErrors.invalidScore');
  }
  
  if (threshold <= 0) {
    throw new Error('zkErrors.invalidThreshold');
  }
  
  // Important: The circuit only accepts integers, not floats
  // Round to integers if needed
  const actualScoreInt = Math.round(actualScore);
  const thresholdInt = Math.round(threshold);
  
  console.log(`Validating Reputation Proof constraints: ${actualScoreInt} >= ${thresholdInt}`);
  
  if (actualScoreInt < thresholdInt) {
    throw new Error('zkErrors.reputation');
  }
  
  console.log(`Generating Reputation Proof with score ${actualScoreInt} against threshold ${thresholdInt}`);
  
  // Pass the integer values directly to ensure they match what circuit expects
  return generateProof({
    choice: 2,
    x: actualScoreInt,
    y: thresholdInt
  });
}

// Generate Ownership Proof
export async function generateOwnershipProof(
  tokenBalance: number, 
  minRequired: number
): Promise<ProofData> {
  // From main.nr, the constraint for Ownership Proof is: assert(x != 0)
  // Where x is the token balance
  
  // Validate inputs
  if (tokenBalance <= 0) {
    throw new Error('zkErrors.tokenBalance');
  }
  
  if (minRequired <= 0) {
    throw new Error('zkErrors.invalidMinimum');
  }
  
  // Check if token balance meets the minimum requirement
  if (tokenBalance < minRequired) {
    throw new Error('zkErrors.tokenBalance'); // Use the same error key for simplicity
  }
  
  // Use integers directly without normalization
  const tokenBalanceInt = Math.round(tokenBalance);
  const minRequiredInt = Math.round(minRequired);
  
  console.log(`Generating Ownership Proof with token balance ${tokenBalanceInt} and minimum required ${minRequiredInt}`);
  
  return generateProof({
    choice: 3,
    x: tokenBalanceInt,
    y: minRequiredInt
  });
}

// Generate Commitment Proof
export async function generateCommitmentProof(
  taskDescription: string, 
  deadline: number
): Promise<ProofData> {
  // From main.nr, the constraint for Commitment Proof is: assert(x != 0)
  // Where x is the commitment hash
  
  const commitmentHash = hashTask(taskDescription);
  const currentTime = Math.floor(Date.now() / 1000);
  
  if (commitmentHash === 0) {
    throw new Error('zkErrors.commitment');
  }
  
  // Check if deadline is in the future
  if (deadline <= currentTime) {
    throw new Error('zkErrors.deadline');
  }
  
  // Use integers directly without normalization
  const deadlineInt = Math.round(deadline);
  
  console.log(`Generating Commitment Proof with hash ${commitmentHash} and deadline ${deadlineInt}`);
  
  return generateProof({
    choice: 4,
    x: commitmentHash,
    y: deadlineInt,
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
  // From main.nr, the constraint for Explorer Badge is: assert(x != 0)
  // Where x is a value derived from the JWT token
  
  // For the demo, we'll use the JWT token length as a simple proxy for the real JWT verification
  const tokenValue = jwtToken.length;
  
  if (tokenValue === 0) {
    throw new Error('zkErrors.jwt');
  }
  
  // Validate required visits
  if (requiredVisits <= 0) {
    throw new Error('zkErrors.requiredVisits');
  }
  
  // Use integers directly without normalization
  const requiredVisitsInt = Math.round(requiredVisits);
  
  console.log(`Generating Explorer Badge Proof with token value ${tokenValue} and required visits ${requiredVisitsInt}`);
  
  return generateProof({
    choice: 5,
    x: tokenValue,
    y: requiredVisitsInt
  });
} 