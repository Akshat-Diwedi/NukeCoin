// Firebase configuration (Replace with your project config)
const firebaseConfig = {
    apiKey: "AIzaSyD9Tf39JZ1rBO2dm4ABPU5inGH3kjrNi78",
    authDomain: "nukecoin-a1db8.firebaseapp.com",
    databaseURL: "https://nukecoin-a1db8-default-rtdb.firebaseio.com",
    projectId: "nukecoin-a1db8",
    storageBucket: "nukecoin-a1db8.firebasestorage.app",
    messagingSenderId: "771900783931",
    appId: "1:771900783931:web:e57304d7c9fe9455d44b1e",
    measurementId: "G-2MCL5LHZW9"
  };

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const database = firebase.database();

// HTML Element References
const authContainer = document.getElementById('authContainer');
const signInBtn = document.getElementById('signInBtn');
const userInfo = document.getElementById('userInfo');
const userAddress = document.getElementById('userAddress');
const userBalance = document.getElementById('userBalance');
const miningProblem = document.getElementById('miningProblem');
const solutionInput = document.getElementById('solutionInput');
const mineButton = document.getElementById('mineButton');
const miningResult = document.getElementById('miningResult');
const recipientAddress = document.getElementById('recipientAddress');
const amount = document.getElementById('amount');
const sendButton = document.getElementById('sendButton');
const transactionResult = document.getElementById('transactionResult');
const signOutBtn = document.getElementById('signOutBtn');

// --- Helper Functions ---

// Generate a simple wallet address (NOT SECURE for real use)
function generateWalletAddress() {
    return 'Nuke' + Math.random().toString(36).substr(2, 9);
}

// Simulate a Proof-of-Work problem
function generateMiningProblem() {
    const difficulty = 2; // Adjust for harder problems
    const problem = {
        data: Math.random().toString(36).substr(2, 10),
        target: '0'.repeat(difficulty),
        nonce: 0 // Add a nonce field
    };

    // Update the mining problem on the UI
    miningProblem.textContent = `Find a nonce such that SHA256(data + nonce) starts with ${problem.target}`;

    currentProblem = problem; // Store the current problem
    return problem;
}

// Verify a solution to the mining problem (using SHA256)
function verifySolution(problem, solution) {
    // Concatenate the problem data with the provided solution (nonce)
    const hash = CryptoJS.SHA256(problem.data + solution).toString();

    // Check if the hash starts with the target string
    return hash.startsWith(problem.target);
}

// --- Firebase Authentication ---

// Handle user sign-in
signInBtn.addEventListener('click', () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
        .then((result) => {
            // User signed in
            console.log("User signed in:", result.user);
        })
        .catch((error) => {
            console.error("Sign-in error:", error);
        });
});

// Handle user sign-out
signOutBtn.addEventListener('click', () => {
    auth.signOut()
        .then(() => {
            // User signed out
            console.log("User signed out");
        })
        .catch((error) => {
            console.error("Sign-out error:", error);
        });
});

// Listen for auth state changes
auth.onAuthStateChanged(user => {
    if (user) {
        // User is signed in
        signInBtn.style.display = "none";
        userInfo.style.display = "block";

        // Get user data (or create if it doesn't exist)
        const userRef = database.ref('users/' + user.uid);
        userRef.once('value', (snapshot) => {
            if (!snapshot.exists()) {
                // New user: generate address ONCE and store it
                const userAddressValue = generateWalletAddress();
                userRef.set({
                    address: userAddressValue,
                    balance: 0, // Initial balance
                });
                userAddress.textContent = userAddressValue;
                userBalance.textContent = 0;
            } else {
                // Existing user: retrieve the address
                const userData = snapshot.val();
                userAddress.textContent = userData.address; // Address is read-only
                userBalance.textContent = userData.balance;
            }
        });

    } else {
        // User is signed out
        signInBtn.style.display = "block";
        userInfo.style.display = "none";
    }
});

// --- Mining Logic ---

let currentProblem = null; // Keep track of the current mining problem

mineButton.addEventListener('click', () => {
    miningResult.textContent = "Mining..."; // Indicate that mining has started

    if (!currentProblem) {
        currentProblem = generateMiningProblem();
    }

    // Use a timeout to simulate mining work and allow UI updates
    setTimeout(() => {
        let nonce = 0;
        while (nonce < 100000) { // Limit the number of attempts for the demo
            if (verifySolution(currentProblem, nonce)) {

                miningResult.textContent = `Success! Mined 7 Nukecoin with nonce: ${nonce}`;

                // Reward the miner (update balance in Firebase)
                const user = auth.currentUser;
                const userRef = database.ref('users/' + user.uid);
                userRef.transaction((currentData) => {
                    if (currentData) {
                        currentData.balance += 7;
                    }
                    return currentData;
                });

                // Add a transaction to the blockchain (simulated)
                const transaction = {
                    from: "network", // Coinbase transaction (reward)
                    to: userAddress.textContent,
                    amount: 7
                };
                updateBlockchain(transaction);

                // Reset mining problem
                currentProblem = null;
                solutionInput.value = "";
                generateMiningProblem();

                return; // Exit the loop after finding a solution
            }
            nonce++;
        }

        // If no solution is found within the limit
        miningResult.textContent = "Mining failed. Try again.";
        currentProblem = null; // Reset the problem
        generateMiningProblem();
    }, 0);
});

// --- Transaction Logic ---

sendButton.addEventListener('click', () => {
    const recipient = recipientAddress.value;
    const sendAmount = parseFloat(amount.value);

    const user = auth.currentUser;
    const senderRef = database.ref('users/' + user.uid);

    senderRef.transaction((currentData) => {
        if (currentData && currentData.balance >= sendAmount) {
            // Deduct from sender's balance
            currentData.balance -= sendAmount;

            // Update recipient's balance (simulated transaction)
            const recipientRef = database.ref('users').orderByChild('address').equalTo(recipient).limitToFirst(1);
            recipientRef.once('value', (snapshot) => {
                if (snapshot.exists()) {
                    snapshot.forEach((childSnapshot) => {
                        const recipientUserRef = database.ref('users/' + childSnapshot.key);
                        recipientUserRef.transaction((recipientData) => {
                            if (recipientData) {
                                recipientData.balance += sendAmount;
                            }
                            return recipientData;
                        });
                    });
                    transactionResult.textContent = "Transaction successful!";
                } else {
                    transactionResult.textContent = "Recipient address not found.";
                }
            });

            // Add transaction to blockchain (simulated)
            const transaction = {
                from: userAddress.textContent,
                to: recipient,
                amount: sendAmount
            };
            updateBlockchain(transaction);

        } else {
            transactionResult.textContent = "Insufficient balance.";
        }

        return currentData; // Update sender's data
    });
});

// --- Simulated Blockchain Interaction ---

function updateBlockchain(transaction) {
    const newBlock = {
        timestamp: Date.now(),
        transaction: transaction
        // Add other block data like previous hash, nonce (for a more realistic blockchain)
    };

    // Push the new block to Firebase (simulating adding to a blockchain)
    database.ref('blockchain').push(newBlock)
        .then(() => console.log("Block added to blockchain (simulated)"))
        .catch((error) => console.error("Error adding block:", error));
}
