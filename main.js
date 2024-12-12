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

// --- Constants ---
const MINING_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds (or a shorter time for testing)
const REWARD_AMOUNT = 5; // Nukecoin reward

// --- Mining Logic ---
let miningStartTime = null;
let miningInterval = null;
let totalHashes = 0; // Keep track of the total number of hashes checked

function generateMiningProblem() {
    const difficulty = 6; // Adjust difficulty as needed
    const problem = {
        data: Math.random().toString(36).substr(2, 10),
        target: '0'.repeat(difficulty),
        nonce: 0
    };

    miningProblem.textContent = `Find a nonce such that SHA256(data + nonce) starts with ${problem.target}`;
    return problem;
}

function verifySolution(problem, solution) {
    const hash = CryptoJS.SHA256(problem.data + solution).toString();
    return hash.startsWith(problem.target);
}

function startMining() {
    miningStartTime = Date.now();
    const problem = generateMiningProblem();
    let nonce = 0;
    totalHashes = 0; // Reset total hashes

    miningResult.textContent = "Mining started...";
    mineButton.disabled = true; // Disable while mining

    miningInterval = setInterval(() => {
        const elapsedTime = Date.now() - miningStartTime;
        if (elapsedTime >= MINING_DURATION) {
            // Time's up!
            clearInterval(miningInterval);
            miningResult.textContent = "Mining time is up!";
            mineButton.disabled = false;
            return;
        }

        // Try a batch of nonces
        let hashesCheckedThisBatch = 0;
        for (let i = 0; i < 10000; i++) { // Adjust batch size as needed
            if (verifySolution(problem, nonce)) {
                // Solution found!
                clearInterval(miningInterval);
                miningResult.textContent = `Success! Mined ${REWARD_AMOUNT} Nukecoin with nonce: ${nonce}. Total hashes checked: ${totalHashes}`;

                // Reward the miner
                const user = auth.currentUser;
                const userRef = database.ref('users/' + user.uid);
                userRef.transaction((currentData) => {
                    if (currentData) {
                        currentData.balance += REWARD_AMOUNT;
                    }
                    return currentData;
                });

                // Add transaction to blockchain (simulated)
                const transaction = {
                    from: "network",
                    to: userAddress.textContent,
                    amount: REWARD_AMOUNT
                };
                updateBlockchain(transaction);

                mineButton.disabled = false;
                return;
            }
            nonce++;
            hashesCheckedThisBatch++;
            totalHashes++; // Increment the total hash count
        }

        // Update UI with hash count and progress
        const progress = (elapsedTime / MINING_DURATION) * 100;
        miningResult.textContent = `Mining... ${progress.toFixed(2)}% - Hashes checked: ${totalHashes}`;

    }, 100); // Adjust interval as needed
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
        authContainer.style.display = "none";
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

// --- Transaction Logic ---

sendButton.addEventListener('click', () => {
    const recipient = recipientAddress.value;
    const sendAmount = parseFloat(amount.value);

    const sendSound = new Audio('https://assets.mixkit.co/active_storage/sfx/1993/1993-preview.mp3');

    sendSound.play()
        .then(() => {
            // Optional: You can add code here to be executed after the sound finishes playing
            console.log("Send sound played successfully.");
        })
        .catch((error) => {
            // Handle errors, for example, if the sound file cannot be played
            console.error("Error playing send sound:", error);
        });


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

// --- Event Listeners ---

mineButton.addEventListener('click', startMining);
