const episodeDropdown = document.getElementById('episode-dropdown');
const episodeImage = document.getElementById('episode-image');
const scoreDisplay = document.getElementById('score');
const feedbackDisplay = document.getElementById('feedback');

let episodes = []; // Array to hold episode names
let currentEpisode = null;
let score = 0;
let highScoreKey = 'highScore_Saw'; // Unique key for Gravity Falls high score
let highScore = localStorage.getItem(highScoreKey) || 0; // Retrieve high score from localStorage


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


// Function to update the score display
function updateScoreDisplay() {
    scoreDisplay.textContent = `Score: ${score} | High Score: ${highScore}`;
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

// Function to check guess
document.getElementById('submit-guess').addEventListener('click', () => {
    const userGuess = episodeDropdown.value;
    if (userGuess === currentEpisode) {
        score++;
        feedbackDisplay.textContent = "Correct!";
    } else {
        feedbackDisplay.textContent = `Incorrect! It was ${currentEpisode}.`;
        // Reset score if guess is incorrect
        score = 0;
    }

    // Check if current score is a new high score
    if (score > highScore) {
        highScore = score;
        localStorage.setItem(highScoreKey, highScore); // Save new high score to localStorage
    }
	
    // Update the score display
    updateScoreDisplay();
    startGame(); // Start a new game round
});

// Load the episodes on page load
loadEpisodes();