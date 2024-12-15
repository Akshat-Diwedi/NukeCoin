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
let miningInterval;
let miningStartTime;
let totalHashes = 0;

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
    new QRCode(qrcodeDiv, {
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
        for (let i = 0; i < 10000; i++) {
            if (verifySolution(problem, nonce)) {
                // Solution found!
                clearInterval(miningInterval);
                miningResult.textContent = `Success! Mined ${REWARD_AMOUNT} Nukecoin with nonce: ${nonce}. Total hashes checked: ${totalHashes}`;

                // Reward the miner
                const user = auth.currentUser;

                // Use a transaction to update balance and total mined coins atomically
                database.ref('/').transaction((currentData) => {
                    if (currentData) {
                        if (currentData.users && currentData.users[user.uid]) {
                            currentData.users[user.uid].balance += REWARD_AMOUNT;
                        }
                        currentData.totalCoinsMined = (currentData.totalCoinsMined || 0) + REWARD_AMOUNT;
                    }
                    return currentData;
                }, (error, committed) => {
                    if (error) {
                        console.error('Transaction failed abnormally!', error);
                    } else if (!committed) {
                        console.log('We aborted the transaction (because totalCoinsMined already exists).');
                    } else {
                        console.log('Mining reward successfully added!');
                        // Add mining reward to transaction history in the blockchain
                        const transaction = {
                            from: "network",
                            to: userAddress.textContent,
                            amount: REWARD_AMOUNT,
                            timestamp: Date.now(),
                            type: 'mined'
                        };
                        updateBlockchain(transaction);
                    }
                });

                mineButton.disabled = false;
                return;
            }
            nonce++;
            totalHashes++;
        }

        // Update UI with hash count and progress
        const progress = (elapsedTime / MINING_DURATION) * 100;
        miningResult.textContent = `Mining... ${progress.toFixed(2)}% - Hashes checked: ${totalHashes}`;

    }, 100);
}

// --- Firebase Authentication ---

// Handle user sign-in
signInBtn.addEventListener('click', () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithRedirect(provider); // Use redirect instead of popup
});

// Handle the redirect result on a separate page or after page reload:
auth.getRedirectResult()
    .then((result) => {
        if (result.credential) {
            // User signed in successfully
            console.log("User signed in:", result.user);
        }
    })
    .catch((error) => {
        console.error("Sign-in error:", error);
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

sendButton.addEventListener('click', async () => {
    const recipient = recipientAddress.value;
    const sendAmount = parseFloat(amount.value);

    // Input validation
    if (!recipient || isNaN(sendAmount) || sendAmount <= 0) {
        transactionResult.textContent = "Please enter a valid recipient address and amount.";
        return;
    }

    const user = auth.currentUser;
    const senderRef = database.ref('users/' + user.uid);
    const recipientRef = database.ref('users').orderByChild('address').equalTo(recipient).limitToFirst(1);

    try {
        // Get sender's current balance
        const senderSnapshot = await senderRef.once('value');
        const senderData = senderSnapshot.val();

        // Check for sufficient balance
        if (!senderData || senderData.balance < sendAmount) {
            transactionResult.textContent = "Insufficient balance.";
            return;
        }

        // Get recipient's data
        const recipientSnapshot = await recipientRef.once('value');
        if (!recipientSnapshot.exists()) {
            transactionResult.textContent = "Recipient address not found.";
            return;
        }

        const recipientKey = Object.keys(recipientSnapshot.val())[0];
        const recipientUserRef = database.ref('users/' + recipientKey);

        // Update sender's balance
        await senderRef.transaction((currentData) => {
            if (currentData) {
                currentData.balance -= sendAmount;
            }
            return currentData;
        });

        // Update recipient's balance
        await recipientUserRef.transaction((currentData) => {
            if (currentData) {
                currentData.balance += sendAmount;
            }
            return currentData;
        });

        // Update blockchain with transaction
        const transaction = {
            from: senderData.address,
            to: recipient,
            amount: sendAmount,
            timestamp: Date.now(),
            type: 'sent'
        };
        updateBlockchain(transaction);

        transactionResult.textContent = "Transaction successful!";

    } catch (error) {
        console.error('Transaction failed:', error);
        transactionResult.textContent = "Transaction failed.";
    }
});

// --- Blockchain and Mining Limit ---

function updateBlockchain(transaction) {
    const newBlockRef = database.ref('blockchain').push();
    newBlockRef.set(transaction)
        .then(() => console.log("Block added to blockchain (simulated)"))
        .catch((error) => console.error("Error adding block:", error));
}

// Initialize totalCoinsMined from the database
database.ref('totalCoinsMined').once('value', (snapshot) => {
    totalCoinsMined = snapshot.val() || 0;
});

// --- Transaction History ---

function loadTransactionHistory(userId) {
    const blockchainRef = database.ref('blockchain');
    blockchainRef.on('value', (snapshot) => {
        transactionHistoryTbody.innerHTML = ""; // Clear previous history

        snapshot.forEach((blockSnapshot) => {
            const transaction = blockSnapshot.val();
            const isSender = transaction.from === userAddress.textContent;
            const isReceiver = transaction.to === userAddress.textContent;

            if (isSender || isReceiver) {
                const row = transactionHistoryTbody.insertRow();
                const dateTimeCell = row.insertCell();
                const typeCell = row.insertCell();
                const amountCell = row.insertCell();
                const otherPartyCell = row.insertCell();

                dateTimeCell.textContent = formatDate(transaction.timestamp);
                typeCell.textContent = transaction.type;
                amountCell.textContent = transaction.amount;

                if (transaction.type === 'mined') {
                    otherPartyCell.textContent = '-';
                } else if (isSender) {
                    otherPartyCell.textContent = transaction.to;
                } else {
                    otherPartyCell.textContent = transaction.from;
                }
            }
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
