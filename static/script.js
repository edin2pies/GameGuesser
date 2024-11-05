// Global variables
const maxTime = 120; // 2 minutes (120 seconds)
let timeLeft;
let basePoints = 100;
let timer; // Timer interval variable, accessible to all functions
let progressBar, mapImage;

// Define the resetGame function in the global scope
function resetGame() {
    console.log("Reset Game function called");

    clearInterval(timer); // Stop the timer
    timeLeft = maxTime; // Reset the time left to maximum
    progressBar.style.width = '100%'; // Reset the progress bar to full width

    fetch("/reset_game", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        }
    })
    .then(response => response.json())
    .then(data => {
        console.log("Reset response:", data); // Log response to verify

        // Clear any "Game Over" messages and prepare for a new game
        const gameContainer = document.getElementById("game");
        gameContainer.innerHTML = `
            <img id="map-image" src="" alt="Map" style="max-width:100%; border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);" />
            <div>
                <input type="text" id="game-name" placeholder="Guess the game name" />
                <input type="text" id="map-name" placeholder="Guess the map name" />
            </div>
            <div class="progress-container">
                <div class="progress-bar" id="progress-bar" style="width: 100%;"></div>
            </div>
            <div class="button-container">
                <button onclick="submitGuess()">Submit Guess</button>
                <button onclick="resetGame()">Reset Game</button>
            </div>
            <p id="feedback"></p>
        `;

        // Reinitialize DOM elements
        mapImage = document.getElementById("map-image");
        progressBar = document.getElementById("progress-bar");

        // Load the first image for the new game
        loadImage();
    })
    .catch(error => console.error("Error resetting game:", error));
}

// Attach resetGame to the global window object
window.resetGame = resetGame;

// Define loadImage, startTimer, and submitGuess in the global scope
function loadImage() {
    if (!mapImage) {
        console.error("Element with ID 'map-image' not found.");
        return;
    }

    fetch("/get_image")
        .then(response => response.json())
        .then(data => {
            if (data.game_over) {
                document.getElementById("game").innerHTML = `
                    <h2>Game Over! No more images available.</h2>
                    <button onclick="resetGame()">Play Again</button>
                `;
                clearInterval(timer); // Stop the timer
            } else if (data.image_path) {
                mapImage.src = data.image_path;
                mapImage.dataset.id = data.id;
                startTimer(); // Start the timer when a new image loads
            } else {
                alert("An error occurred. Please try again.");
            }
        });
}

function startTimer() {
    timeLeft = maxTime; // Reset time

    clearInterval(timer); // Clear any existing timer interval

    timer = setInterval(() => {
        timeLeft -= 1;

        if (timeLeft >= 0) {
            // Update the width of the progress bar
            const progressPercentage = (timeLeft / maxTime) * 100;
            progressBar.style.width = `${progressPercentage}%`;

        } else {
            clearInterval(timer); // Stop the timer when it reaches 0
            submitGuess(); // Automatically submit if time runs out
        }
    }, 1000); // Update every second
}

function submitGuess() {
    const mapId = mapImage ? mapImage.dataset.id : null;
    const gameName = document.getElementById("game-name").value;
    const mapName = document.getElementById("map-name").value;

    clearInterval(timer); // Stop the timer when the user submits

    // Calculate score based on remaining time
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
            setTimeout(loadImage, 1000); // Automatically load a new image after 1 second
        } else if (data.result === "not_logged_in") {
            feedback.textContent = data.message;  // Display login prompt
        } else {
            feedback.textContent = "Incorrect. Try again!";
        }
    });
}

// Initialize elements and load the first image when the DOM is fully loaded
document.addEventListener("DOMContentLoaded", function() {
    progressBar = document.getElementById('progress-bar');
    mapImage = document.getElementById('map-image');

    setTimeout(() => {
        loadImage();
    }, 100);
});
