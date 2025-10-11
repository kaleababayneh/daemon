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

    let commitment = Poseidon2::hash([secret_key, secret_answer_one], 2);

    let computed_nullifier_hash = Poseidon2::hash([
        secret_key, 
        secret_answer_two,
        new_owner,     
        current_owner   
    ], 4);
    assert(computed_nullifier_hash == nullifier_hash);
   
    let mut is_commited: bool = false; 

    for i in 0..10 {
        if guardians_commitment[i] == commitment {
            is_commited = true;
        }
    }

    assert(is_commited);
}



#[test]
fn test_main() {
    
}
