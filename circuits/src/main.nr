use poseidon::poseidon2::Poseidon2;


fn main(
    // public inputs
    nullifier_hash: pub Field,
    guardians_commitment: pub [Field; 5],
    // private inputs
    secret_answer_one: Field,
    secret_answer_two: Field,
    secret_key: Field,
) {
    
    let computed_nullifier_hash = Poseidon2::hash([secret_key, secret_answer_two], 2);
    assert(computed_nullifier_hash == nullifier_hash);
   
    let mut is_commited: bool = false; 
    let commitment = Poseidon2::hash([secret_key, secret_answer_one], 2);

    for i in 0..5 {
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
 
}