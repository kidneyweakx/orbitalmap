mod proof_of_visit;
mod reputation_proofs;
mod ownership_proofs;
mod trustless_commitments;

// Main function that dispatches to the different proof types
fn main(choice: Field, x: Field, y: Field) {
    // This is a simple dispatcher function
    // The choice parameter determines which proof type to execute
    if choice == 1 {
        // Proof of Visit
        assert(x != 0);
    } else if choice == 2 {
        // Reputation Proof
        assert((x as i64) >= (y as i64));
    } else if choice == 3 {
        // Ownership Proof
        assert(x != 0);
    } else if choice == 4 {
        // Trustless Commitment
        assert(x != 0);
    } else {
        assert(false); // Invalid choice
    }
}

#[test]
fn test_main() {
    // These are just basic tests to ensure the main dispatcher works
    // The actual functionality is tested in the respective modules
    
    // Test Proof of Visit dispatcher
    main(1, 42, 0);
    
    // Test Reputation Proof dispatcher
    main(2, 100, 80);
    
    // Test Ownership Proof dispatcher
    main(3, 42, 0);
    
    // Test Trustless Commitment dispatcher
    main(4, 42, 0);
    
    // Uncomment to test failure cases:
    // Invalid choice
    // main(5, 42, 0);
    
    // Reputation threshold not met
    // main(2, 70, 80);
}
