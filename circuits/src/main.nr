use poseidon::poseidon2::Poseidon2;


fn main(
    // public inputs
    nullifier_hash: pub Field,
    guardians_commitment: pub [Field; 10],
    new_owner: pub Field,       
    current_owner: pub Field,   
    // private inputs
    secret_answer_one: Field,
    secret_answer_two: Field,
    secret_key: Field,
) {
    
    let computed_nullifier_hash = Poseidon2::hash([
        secret_key, 
        secret_answer_two,
        new_owner,     
        current_owner   
    ], 4);
    assert(computed_nullifier_hash == nullifier_hash);
   
    let mut is_commited: bool = false; 
    let commitment = Poseidon2::hash([secret_key, secret_answer_one], 2);

    for i in 0..10 {
        if guardians_commitment[i] == commitment {
            is_commited = true;
        }
    }

    assert(is_commited);

    // let guardian_binding = guardian * guardian;
    // assert(guardian_binding == guardian * guardian);
}



#[test]
fn test_main() {
    // Test data setup
    let secret_key = 12345;
    let secret_answer_one = 67890;
    let secret_answer_two = 54321;
    let new_owner = 0x1234567890abcdef; // Recovery target
    let current_owner = 0xabcdef1234567890; // Current account owner
    
    // Create guardian commitment
    let guardian_commitment = Poseidon2::hash([secret_key, secret_answer_one], 2);
    
    // Create nullifier hash with ALL required fields
    let nullifier_hash = Poseidon2::hash([
        secret_key, 
        secret_answer_two,
        new_owner,
        current_owner
    ], 4);
    
    // Setup guardians commitment array
    let mut guardians_commitment = [0; 10];
    guardians_commitment[0] = 11111;
    guardians_commitment[1] = 22222;
    guardians_commitment[2] = guardian_commitment;
    guardians_commitment[3] = 33333;
    guardians_commitment[4] = 44444;
    guardians_commitment[5] = 55555;
    guardians_commitment[6] = 66666;
    guardians_commitment[7] = 77777;
    guardians_commitment[8] = 88888;
    guardians_commitment[9] = 99999;

    // Call main function with correct signature
    main(
        nullifier_hash,
        guardians_commitment,
        new_owner,     
        current_owner,  
        secret_answer_one,
        secret_answer_two,
        secret_key
    );
}

#[test(should_fail)]
fn test_invalid_guardian_should_fail() {
    let secret_key = 12345;
    let secret_answer_one = 67890;
    let secret_answer_two = 54321;
    let new_owner = 0x1234567890abcdef;
    let current_owner = 0xabcdef1234567890;
    
    let nullifier_hash = Poseidon2::hash([
        secret_key, 
        secret_answer_two,
        new_owner,
        current_owner
    ], 4);
    
    // Create guardians list WITHOUT our guardian
    let guardians_commitment = [11111, 22222, 33333, 44444, 55555, 66666, 77777, 88888, 99999, 101010];
    
    main(
        nullifier_hash,
        guardians_commitment,
        new_owner,
        current_owner,
        secret_answer_one,
        secret_answer_two,
        secret_key
    );
}