// Global variables
const maxTime = 30; // 30 seconds
let timeLeft;
let basePoints = 100;
let timer; // Timer interval variable, accessible to all functions
let countdownTimer; // Countdown timer for start
let countdownValue; // Current countdown value

// Define functions to initialize elements and attach event listeners
function initializeElements() {
    // Reinitialize elements after page load
    startButton = document.getElementById("start-button");
    overlay = document.getElementById("overlay");
    countdown = document.getElementById("countdown");
    progressBar = document.getElementById("progress-bar");
    mapImage = document.getElementById("map-image");

    // Attach start game functionality
    if (startButton) {
        startButton.onclick = startGame;
    }

    // Attach reset functionality to window object for dynamic elements
    window.resetGame = resetGame;
}

// Function to start the game with countdown
function startGame() {
    console.log("Start game function called");

    // Hide the Start button and show the overlay with countdown
    startButton.classList.add("hidden");
    overlay.style.visibility = "visible";
    countdownValue = 3; // Start countdown from 3
    countdown.textContent = countdownValue;

    // Begin countdown
    countdownTimer = setInterval(() => {
        countdownValue -= 1;
        countdown.textContent = countdownValue;

        if (countdownValue <= 0) {
            clearInterval(countdownTimer); // Stop the countdown timer
            overlay.style.visibility = "hidden"; // Hide the overlay
            loadImage(); // Load the first image and start the game
        }
    }, 1000); // Countdown interval is 1 second
}

// Function to start a new game and redirect
function startNewGame() {
    console.log("Starting a new game...");

    // Clear any active game or countdown timers
    clearInterval(timer);
    clearInterval(countdownTimer);

    // Send a request to reset the game on the server side
    fetch("/reset_game", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        }
    })
    .then(response => response.json())
    .then(data => {
        console.log("Game reset on server:", data);

        // Redirect to the home page to start a fresh game
        window.location.href = "/";
    })
    .catch(error => console.error("Error starting new game:", error));
}

// Function to reset the game without reloading the page
function resetGame() {
    console.log("Reset Game function called");

    // Clear any active timers
    clearInterval(timer);
    clearInterval(countdownTimer);

    // Reset countdown and show the overlay
    overlay.style.visibility = "visible";
    countdownValue = 3;
    countdown.textContent = countdownValue;
    startButton.classList.remove("hidden"); // Show Start button for new game

    // Send a request to reset the game on the server side
    fetch("/reset_game", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        }
    })
    .then(response => response.json())
    .then(data => {
        console.log("Reset response:", data);
        progressBar.style.width = '100%'; // Reset progress bar
        startGame(); // Automatically start the game with a new countdown
    })
    .catch(error => console.error("Error resetting game:", error));
}

// Function to load the first image when game starts
function loadImage() {
    fetch("/get_image")
        .then(response => response.json())
        .then(data => {
            if (data.game_over) {
                document.getElementById("game").innerHTML = `
                    <h2>Game Over! No more images available.</h2>
                    <button onclick="startNewGame()">Play Again</button>
                `;
            } else if (data.image_path) {
                mapImage.src = data.image_path;
                mapImage.dataset.id = data.id;
                startTimer(); // Start the timer when a new image loads
            } else {
                alert("An error occurred. Please try again.");
            }
        });
}

// Timer function for the game
function startTimer() {
    timeLeft = maxTime;
    clearInterval(timer); // Clear any existing timer interval

    timer = setInterval(() => {
        timeLeft -= 1;
        const progressPercentage = (timeLeft / maxTime) * 100;
        progressBar.style.width = `${progressPercentage}%`;

        if (timeLeft <= 0) {
            clearInterval(timer);
            submitGuess(); // Automatically submit if time runs out
        }
    }, 1000);
}

function submitGuess() {
    const mapId = mapImage ? mapImage.dataset.id : null;
    const gameName = document.getElementById("game-name").value;
    const mapName = document.getElementById("map-name").value;

    clearInterval(timer); // Stop the timer when the user submits

    const score = Math.floor(basePoints * (timeLeft / maxTime));

    fetch("/submit_answer", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            id: mapId,
            game_name: gameName,
            map_name: mapName,
            score: score
        })
    })
    .then(response => response.json())
    .then(data => {
        const feedback = document.getElementById("feedback");
        if (data.result === "correct") {
            feedback.textContent = `Correct! You scored ${score} points.`;
            setTimeout(loadImage, 1000); // Load a new image after 1 second
        } else if (data.result === "not_logged_in") {
            feedback.textContent = data.message;
        } else {
            feedback.textContent = "Incorrect. Try again!";
        }
    });
}

// Initialize elements and load the first image when the DOM is fully loaded
document.addEventListener("DOMContentLoaded", function() {
    initializeElements();

    // Optionally load the first image if needed
    setTimeout(() => {
        loadImage();
    }, 100);
});
