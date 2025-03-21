// Reputation Proofs - allows users to prove their reputation meets certain thresholds
// without revealing the exact values

// Prove reputation score is above a threshold
fn prove_reputation_above_threshold(
    actual_score: Field,
    threshold: Field
) {
    assert((actual_score as i64) >= (threshold as i64));
}

// Prove number of completed tasks is above a threshold
fn prove_tasks_completed(
    actual_tasks_completed: Field,
    min_required: Field
) {
    assert((actual_tasks_completed as i64) >= (min_required as i64));
}

// Prove total rewards value is above a threshold
fn prove_rewards_value(
    actual_rewards: Field, 
    min_rewards: Field
) {
    assert((actual_rewards as i64) >= (min_rewards as i64));
}

// Combined reputation proof that checks multiple conditions
fn prove_reputation(
    actual_score: Field,
    min_score: Field,
    tasks_completed: Field,
    min_tasks: Field,
    total_rewards: Field,
    min_rewards: Field
) {
    // Verify all reputation metrics meet or exceed the required thresholds
    assert((actual_score as i64) >= (min_score as i64));
    assert((tasks_completed as i64) >= (min_tasks as i64));
    assert((total_rewards as i64) >= (min_rewards as i64));
}

#[test]
fn test_reputation_proofs() {
    // Test scenario: User has a reputation score of 95, completed 37 tasks, and earned 1250 tokens
    let user_score = 95;
    let user_tasks = 37;
    let user_rewards = 1250;
    
    // Test individual proofs
    prove_reputation_above_threshold(user_score, 80); // Proving score above 80
    prove_tasks_completed(user_tasks, 30); // Proving completed more than 30 tasks
    prove_rewards_value(user_rewards, 1000); // Proving earned more than 1000 tokens
    
    // Test combined proof
    prove_reputation(user_score, 80, user_tasks, 30, user_rewards, 1000);
    
    // Uncomment to test failure cases:
    // Score below threshold
    // prove_reputation_above_threshold(user_score, 100);
    
    // Tasks below required
    // prove_tasks_completed(user_tasks, 50);
    
    // Rewards below threshold
    // prove_rewards_value(user_rewards, 1500);
} 