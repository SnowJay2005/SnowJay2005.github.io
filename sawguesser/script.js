const episodeDropdown = document.getElementById('episode-dropdown');
const episodeImage = document.getElementById('episode-image');
const scoreDisplay = document.getElementById('score');
const feedbackDisplay = document.getElementById('feedback');

let episodes = []; // Array to hold episode names
let currentEpisode = null;
let score = 0;

let highScoreKey = 'highScore_Saw'; // Unique key for Gravity Falls high score
// Retrieve saved values from localStorage or initialize with defaults
let gameData = JSON.parse(localStorage.getItem(highScoreKey)) || {
    highScore: 0,
    correctGuesses: 0,
    incorrectGuesses: 0
};

// Ensure values are numbers and default to 0 if missing or invalid
let highScore = gameData.highScore || 0;
let correctGuesses = gameData.correctGuesses || 0;
let incorrectGuesses = gameData.incorrectGuesses || 0;

// Function to load episode names (you can hardcode them for now)
function loadEpisodes() {
    episodes = [
    "(01) Saw I",
    "(02) Saw II",
    "(03) Saw III",
    "(04) Saw IV",
    "(05) Saw V",
    "(06) Saw VI",
    "(07) Saw VII or 3D",
    "(08) Jigsaw",
    "(09) Spiral From the Book of Saw",
	"(10) Saw X",
    ];

    episodes.forEach(episode => {
        const option = document.createElement('option');
        option.value = episode;
        option.textContent = episode;
        episodeDropdown.appendChild(option);
    });
	
	// Initialize the score display
    updateScoreDisplay();

    // Start the game by selecting a random episode and image
    startGame();
}


// Function to update the score and ratio display
function updateScoreDisplay() {
    let totalGuesses = correctGuesses + incorrectGuesses;
    let ratio = totalGuesses > 0 ? ((correctGuesses / totalGuesses) * 100).toFixed(2) : '0.00';

    scoreDisplay.innerHTML = `
        Score: ${score} | High Score: ${highScore}<br>
        <br>Ratio: ${ratio}%<br>
        Correct: ${correctGuesses} | Incorrect: ${incorrectGuesses}
    `;
}


// Function to start the game
function startGame() {
    const randomIndex = Math.floor(Math.random() * episodes.length);
    currentEpisode = episodes[randomIndex];

    // Get a random frame image from the episode's folder
    const randomFrame = getRandomFrame();
    episodeImage.src = `frames/${currentEpisode}/${randomFrame}`; // Set the image source to the random frame
}

// Function to get a random frame from the episode
function getRandomFrame() {
    const frameNumber = Math.floor(Math.random() * 120) + 1; // Random number between 1 and 10
    const formattedNumber = String(frameNumber).padStart(3, '0'); // Format as "001" to "010"
    return `frame_${formattedNumber}.webp`;
}

// Function to reset the score
function resetScore() {
    if (confirm("Are you sure you want to reset your score?")) {
        score = 0; // Reset the current score
        correctGuesses = 0; // Reset correct guesses
        incorrectGuesses = 0; // Reset incorrect guesses
        highScore = 0; // Reset high score
        localStorage.setItem(highScoreKey, highScore); // Update high score in localStorage
        updateScoreDisplay(); // Update the display
        alert("Score has been reset!"); // Optional alert
    }
}

// Event listener for the reset score button
document.getElementById('reset-score').addEventListener('click', resetScore);

// Function to check guess
document.getElementById('submit-guess').addEventListener('click', () => {
    const userGuess = episodeDropdown.value;
    if (userGuess === currentEpisode) {
        score++;
		correctGuesses++; // Increase correct guesses
        feedbackDisplay.textContent = "Correct!";
    } else {
		incorrectGuesses++; // Increase incorrect guesses
        feedbackDisplay.textContent = `Incorrect! It was ${currentEpisode}.`;
        // Reset score if guess is incorrect
        score = 0;
    }

    // Check if current score is a new high score
    if (score > highScore) {
        highScore = score;
    }
	
	    // Save all data to localStorage
    localStorage.setItem(highScoreKey, JSON.stringify({
        highScore,
        correctGuesses,
        incorrectGuesses
    }));
	
    // Update the score display
    updateScoreDisplay();
    startGame(); // Start a new game round
});

// Load the episodes on page load
loadEpisodes();