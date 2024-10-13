const episodeDropdown = document.getElementById('episode-dropdown');
const episodeImage = document.getElementById('episode-image');
const scoreDisplay = document.getElementById('score');
const feedbackDisplay = document.getElementById('feedback');

let episodes = []; // Array to hold episode names
let currentEpisode = null;
let score = 0;

let highScoreKey = 'highScore_TwinPeaks'; // Unique key for Gravity Falls high score
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
    "S01E01 Pilot",
    "S01E02 Traces To Nowhere",
    "S01E03 Zen Or The Skill To Catch A Kill",
    "S01E04 Rest In Pain",
    "S01E05 The One Armed Man",
    "S01E06 Coopers Dreams",
    "S01E07 Realization Time",
    "S01E08 The Last Evening",
    "S02E01 May The Giant Be With You",
    "S02E02 Coma",
    "S02E03 The Man Behind Glass",
    "S02E04 Lauras Secret Diary",
    "S02E05 The Orchids Curse",
    "S02E06 Demons",
    "S02E07 Lonely Souls",
    "S02E08 Drive With A Dead Girl",
    "S02E09 Arbitrary Law",
    "S02E10 Dispute Between Brothers",
    "S02E11 Masked Ball",
    "S02E12 The Black Widow",
    "S02E13 Checkmate",
    "S02E14 Double Play",
    "S02E15 Slaves And Masters",
    "S02E16 The Condemned Woman",
    "S02E17 Wounds And Scars",
    "S02E18 On The Wings Of Love",
    "S02E19 Variations On Relations",
    "S02E20 The Path To The Black Lodge",
    "S02E21 Miss",
    "S02E22 Beyond Life And Death",
    "S03E01 Part 1 My Log Has a Message for You",
    "S03E02 Part 2 The Stars Turn and a Time Presents Itself",
    "S03E03 Part 3 Call for Help",
    "S03E04 Part 4 ...Brings Back Some Memories",
    "S03E05 Part 5 Case Files",
    "S03E06 Part 6 Don't Die",
    "S03E07 Part 7 There's a Body All Right",
    "S03E08 Part 8 Gotta Light",
    "S03E09 Part 9 This Is the Chair",
    "S03E10 Part 10 Laura Is the One",
    "S03E11 Part 11 There's Fire Where You Are Going",
    "S03E12 Part 12 Let's Rock",
    "S03E13 Part 13 What Story Is That, Charlie",
    "S03E14 Part 14 We Are Like the Dreamer",
    "S03E15 Part 15 There's Some Fear in Letting Go",
    "S03E16 Part 16 No Knock, No Doorbell",
    "S03E17 Part 17 The Past Dictates the Future",
    "S03E18 Part 18 What Is Your Name",
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
    const frameNumber = Math.floor(Math.random() * 60) + 1; // Random number between 1 and 10
    const formattedNumber = String(frameNumber).padStart(3, '0'); // Format as "001" to "010"
    return `frame_${formattedNumber}.avif`;
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