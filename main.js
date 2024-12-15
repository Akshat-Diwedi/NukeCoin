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
const qrcodeDiv = document.getElementById('qrcode');
const scanQRButton = document.getElementById('scanQRButton');
const qrVideo = document.getElementById('qrVideo');
const closeScannerButton = document.getElementById('closeScanner');
const transactionHistoryTbody = document.getElementById('transactionHistory').getElementsByTagName('tbody')[0];

// --- Constants ---
const MINING_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds
const REWARD_AMOUNT = 5; // Nukecoin reward
const MAX_COIN_SUPPLY = 15000000;

// --- Global Variables ---
let totalCoinsMined = 0;

// --- Helper Functions ---
function generateWalletAddress() {
    return 'Nuke' + Math.random().toString(36).substr(2, 9);
}

function formatDate(timestamp) {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
}

// --- QR Code Generation ---

function generateQRCode(text) {
    qrcodeDiv.innerHTML = ""; // Clear previous QR code
    const qrcode = new QRCode(qrcodeDiv, {
        text: text,
        width: 128,
        height: 128,
    });
}

// --- QR Code Scanning ---

function startQRScanner() {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
        .then(function (stream) {
            qrVideo.srcObject = stream;
            qrVideo.play();

            const qrCodeScanner = setInterval(() => {
                const canvasElement = document.createElement('canvas');
                const canvas = canvasElement.getContext('2d');
                canvasElement.width = qrVideo.videoWidth;
                canvasElement.height = qrVideo.videoHeight;
                canvas.drawImage(qrVideo, 0, 0, canvasElement.width, canvasElement.height);
                const imageData = canvas.getImageData(0, 0, canvasElement.width, canvasElement.height);
                const code = jsQR(imageData.data, imageData.width, imageData.height);

                if (code) {
                    clearInterval(qrCodeScanner);
                    recipientAddress.value = code.data;
                    closeQRScanner(); // Close the scanner after successful scan
                    console.log("QR Code data:", code.data);
                }
            }, 500); // Scan every 500ms
        })
        .catch(function (err) {
            console.error("Error accessing camera:", err);
        });
}

function closeQRScanner() {
    const stream = qrVideo.srcObject;
    if (stream) {
        const tracks = stream.getTracks();
        tracks.forEach(track => track.stop());
        qrVideo.srcObject = null;
    }
    document.querySelector('.qr-scanner').style.display = 'none';
}

// --- Mining Logic ---

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
    if (totalCoinsMined + REWARD_AMOUNT > MAX_COIN_SUPPLY) {
        miningResult.textContent = "Maximum coin supply reached. Mining is no longer available.";
        mineButton.disabled = true;
        return;
    }

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

                // Add mining reward to transaction history
                const userHistoryRef = database.ref('users/' + user.uid + '/transactionHistory');
                userHistoryRef.push({
                    timestamp: Date.now(),
                    type: 'mined',
                    amount: REWARD_AMOUNT,
                    otherParty: null
                });

                // Update total mined coins in the database
                database.ref('totalCoinsMined').transaction((currentTotal) => {
                    return (currentTotal || 0) + REWARD_AMOUNT;
                });

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
                // New user: generate address and set initial data
                const userAddressValue = generateWalletAddress();
                userRef.set({
                    address: userAddressValue,
                    balance: 0
                });
                userAddress.textContent = userAddressValue;
                userBalance.textContent = 0;

                // Generate QR code for the new user
                generateQRCode(userAddressValue);
            } else {
                // Existing user: retrieve data
                const userData = snapshot.val();
                userAddress.textContent = userData.address;
                userBalance.textContent = userData.balance;

                // Generate QR code for the existing user
                generateQRCode(userData.address);
            }
        });

        // Load transaction history
        loadTransactionHistory(user.uid);

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
            console.log("Send sound played successfully.");
        })
        .catch((error) => {
            console.error("Error playing send sound:", error);
        });

    const user = auth.currentUser;
    const senderRef = database.ref('users/' + user.uid);

    senderRef.transaction((currentData) => {
        if (currentData && currentData.balance >= sendAmount) {
            // Deduct from sender's balance
            currentData.balance -= sendAmount;

            // Add transaction to sender's history
            const senderHistoryRef = database.ref('users/' + user.uid + '/transactionHistory');
            senderHistoryRef.push({
                timestamp: Date.now(),
                type: 'sent',
                amount: sendAmount,
                otherParty: recipient
            });

            // Update recipient's balance and transaction history (simulated transaction)
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

                        // Add transaction to recipient's history
                        const recipientHistoryRef = database.ref('users/' + childSnapshot.key + '/transactionHistory');
                        recipientHistoryRef.push({
                            timestamp: Date.now(),
                            type: 'received',
                            amount: sendAmount,
                            otherParty: currentData.address
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

// --- Blockchain and Mining Limit ---

function updateBlockchain(transaction) {
    const newBlock = {
        timestamp: Date.now(),
        transaction: transaction
    };

    database.ref('blockchain').push(newBlock)
        .then(() => console.log("Block added to blockchain (simulated)"))
        .catch((error) => console.error("Error adding block:", error));
}

// Initialize totalCoinsMined from the database
database.ref('totalCoinsMined').once('value', (snapshot) => {
    totalCoinsMined = snapshot.val() || 0;
});

// --- Transaction History ---

function loadTransactionHistory(userId) {
    const transactionHistoryRef = database.ref('users/' + userId + '/transactionHistory');
    transactionHistoryRef.on('value', (snapshot) => {
        transactionHistoryTbody.innerHTML = ""; // Clear previous history

        snapshot.forEach((childSnapshot) => {
            const transaction = childSnapshot.val();
            const row = transactionHistoryTbody.insertRow();
            const dateTimeCell = row.insertCell();
            const typeCell = row.insertCell();
            const amountCell = row.insertCell();
            const otherPartyCell = row.insertCell();

            dateTimeCell.textContent = formatDate(transaction.timestamp);
            typeCell.textContent = transaction.type;
            amountCell.textContent = transaction.amount;
            otherPartyCell.textContent = transaction.otherParty || '-';
        });
    });
}

// --- Event Listeners ---

mineButton.addEventListener('click', startMining);

scanQRButton.addEventListener('click', () => {
    document.querySelector('.qr-scanner').style.display = 'block';
    startQRScanner();
});

closeScannerButton.addEventListener('click', closeQRScanner);
