const episodeDropdown = document.getElementById('episode-dropdown');
const episodeImage = document.getElementById('episode-image');
const scoreDisplay = document.getElementById('score');
const feedbackDisplay = document.getElementById('feedback');

let episodes = []; // Array to hold episode names
let currentEpisode = null;
let score = 0;
let highScore = localStorage.getItem('highScore') || 0; // Retrieve high score from localStorage

// Function to load episode names (you can hardcode them for now)
function loadEpisodes() {
    episodes = [
    "S01E01 Tourist Trapped",
    "S01E02 The Legend of the Gobblewonker",
    "S01E03 Headhunters",
    "S01E04 The Hand That Rocks the Mabel",
    "S01E05 The Inconveniencing",
    "S01E06 Dipper vs Manliness",
    "S01E07 Double Dipper",
    "S01E08 Irrational Treasure",
    "S01E09 The Time Travelers Pig",
    "S01E10 Fight Fighters",
    "S01E11 Little Dipper",
    "S01E12 Summerween",
    "S01E13 Boss Mabel",
    "S01E14 Bottomless Pit",
    "S01E15 The Deep End",
    "S01E16 Carpet Diem",
    "S01E17 Boyz Crazy",
    "S01E18 Land Before Swine",
    "S01E19 Dreamscaperers",
    "S01E20 Gideon Rises",
    "S02E01 Scary-oke.mkv",
    "S02E02 Into the Bunker",
    "S02E03 The Golf War",
    "S02E04 Sock Opera",
    "S02E05 Soos and The Real Girl",
    "S02E06 Little Gift Shop of Horrors",
    "S02E07 Society of The Blind Eye",
    "S02E08 Blendins Game",
    "S02E09 The Love God",
    "S02E10 Northwest Mansion Mystery",
    "S02E11 Not What He Seems",
    "S02E12 A Tale of Two Stans",
    "S02E13 Dungeons Dungeons and More Dungeons",
    "S02E14 The Stanchurian Candidate",
    "S02E15 The Last Mabelcorn",
    "S02E16 Roadside Attraction",
    "S02E17 Dipper and Mabel Vs The Future",
    "S02E18 Weirdmageddon",
    "S02E19 Weirdmageddon 2 Escape From Reality",
    "S02E20 Weirdmageddon 3 Take Back The Falls",
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
    const frameNumber = Math.floor(Math.random() * 23) + 1; // Random number between 1 and 10
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
        localStorage.setItem('highScore', highScore); // Save new high score to localStorage
    }
	
    // Update the score display
    updateScoreDisplay();
    startGame(); // Start a new game round
});

// Load the episodes on page load
loadEpisodes();