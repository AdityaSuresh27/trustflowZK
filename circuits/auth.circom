pragma circom 2.1.0;

include "node_modules/circomlib/circuits/poseidon.circom";

template Auth() {
    // Private Inputs (Stay on user's phone)
    signal input pin;
    signal input salt; // A random number to prevent brute-force attacks

    // Public Input (Stored on the Blockchain)
    signal input pinHash;

    // Logic: Hash the PIN + Salt
    component hasher = Poseidon(2);
    hasher.inputs[0] <== pin;
    hasher.inputs[1] <== salt;

    // Constraint: The calculated hash must match the public hash
    pinHash === hasher.out;
}

component main {public [pinHash]} = Auth();
