const maxTime = 120; // 2 minutes (120 seconds)
let timeLeft;
let basePoints = 100;
const timerDisplay = document.getElementById('time-display');
const progressRing = document.querySelector('.progress-ring');
const circumference = 2 * Math.PI * 45; // Circle radius of 45
progressRing.style.strokeDasharray = circumference;

// Load a new image when the page loads
document.addEventListener("DOMContentLoaded", loadImage);

function updateTimerDisplay() {
    // Format time as MM:SS
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function setProgress(value) {
    // Calculate stroke-dashoffset based on remaining time
    const offset = circumference - (value / maxTime) * circumference;
    progressRing.style.strokeDashoffset = offset;
}

// Function to load a new random image
function loadImage() {
    fetch("/get_image")
        .then(response => response.json())
        .then(data => {
            if (data.game_over) {
                document.getElementById("game").innerHTML = `
                    <h2>Game Over! No more images available.</h2>
                    <button onclick="resetGame()">Play Again</button>
                `;
                document.getElementById("timer").textContent = ""; // Clear the timer if it's running
                clearInterval(timer); // Stop the timer
            } else if (data.image_path) {
                document.getElementById("map-image").src = data.image_path;
                document.getElementById("map-image").dataset.id = data.id;
                startTimer(); // Start the timer when a new image loads
            } else {
                alert("An error occurred. Please try again.");
            }
        });
}

// Function to start the timer
function startTimer() {
    timeLeft = maxTime; // Initialize timeLeft to maxTime for each new image
    updateTimerDisplay(); // Display the initial time
    setProgress(timeLeft); // Set initial ring progress

    // Clear any previous timer before starting a new one
    clearInterval(timer);

    // Start a new interval timer
    timer = setInterval(() => {
        timeLeft -= 1;
        if (timeLeft >= 0) {
            updateTimerDisplay(); // Update the display text
            setProgress(timeLeft); // Update the circular progress
        } else {
            clearInterval(timer); // Stop the timer when time runs out
            submitGuess(); // Automatically submit if time runs out
        }
    }, 1000); // Update every second
}

function submitGuess() {
    const mapId = document.getElementById("map-image").dataset.id;
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
            setTimeout(loadImage, 1000); // Automatically load a new image after 1 seconds
        } else if (data.result === "not_logged_in") {
            feedback.textContent = data.message;  // Display login prompt
        } else {
            feedback.textContent = "Incorrect. Try again!";
        }
    });
}

function resetGame() {
    fetch("/reset_game", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        }
    })
    .then(response => response.json())
    .then(data => {
        // Redirect to index.html
        window.location.href = '/';
    })
    .catch(error => console.error("Error resetting game:", error));
}
