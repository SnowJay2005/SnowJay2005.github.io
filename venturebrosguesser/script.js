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
    "S00E01 A Very Venture Christmas",
    "S00E02 From the Ladle to the Grave The Story of Shallow Gravy",
    "S00E03 A Very Venture Halloween",
    "S00E04 All This and Gargantua 2",
    "S01E00 The Terrible Secret of Turtle Bay (Pilot Episode)",
    "S01E01 Dia de Los Dangerous",
    "S01E02 Careers in Science",
    "S01E03 Home Insecurity",
    "S01E04 The Incredible Mr. Brisby",
    "S01E05 Eeney, Meeney, Miney... Magic",
    "S01E06 Ghosts of the Sargasso",
    "S01E07 Ice Station – Impossible",
    "S01E08 Mid-Life Chrysalis",
    "S01E09 Are You There, God It's Me, Dean",
    "S01E10 Tag Sale – You're It",
    "S01E11 Past Tense",
    "S01E12 The Trial of the Monarch",
    "S01E13 Return to Spider-Skull Island",
    "S02E01 Powerless in the Face of Death",
    "S02E02 Hate Floats",
    "S02E03 Assassinanny 911",
    "S02E04 Escape to the House of Mummies Part II",
    "S02E05 Twenty Years to Midnight",
    "S02E06 Victor. Echo. November",
    "S02E07 Love-Bheits",
    "S02E08 Fallen Arches",
    "S02E09 Guess Who's Coming to State Dinner",
    "S02E10 I Know Why the Caged Bird Kills",
    "S02E11 Viva los Muertos",
    "S02E12 Showdown at Cremation Creek (Part I)",
    "S02E13 Showdown at Cremation Creek (Part II)",
    "S03E01 Shadowman 9 In the Cradle of Destiny",
    "S03E02 The Doctor Is Sin",
    "S03E03 The Invisible Hand of Fate",
    "S03E04 Home Is Where the Hate Is",
    "S03E05 The Buddy System",
    "S03E06 Dr. Quymn, Medicine Woman",
    "S03E07 What Goes Down Must Come Up",
    "S03E08 Tears Of a Sea Cow",
    "S03E09 Now Museum-Now You Don't",
    "S03E10 The Lepidopterists",
    "S03E11 ORB",
    "S03E12 The Family That Slays Together, Stays Together (Part I)",
    "S03E13 The Family That Slays Together, Stays Together (Part II)",
    "S04E01 Blood of the Father, Heart of Steel",
    "S04E02 Handsome Ransome",
    "S04E03 Perchance to Dean",
    "S04E04 Return to Malice",
    "S04E05 The Revenge Society",
    "S04E06 Self Medication",
    "S04E07 The Better Man",
    "S04E08 Pinstripes & Poltergeists",
    "S04E09 The Diving Bell Vs. The Butter-Glider",
    "S04E10 Pomp & Circuitry",
    "S04E11 Any Which Way But Zeus",
    "S04E12 Everybody Comes To Hank's",
    "S04E13 Bright Lights, Dean City",
    "S04E14 Assisted Suicide",
    "S04E15 The Silent Partners",
    "S04E16 Operation P.R.O.M",
    "S05E01 What Color Is Your Cleansuit",
    "S05E02 Venture Libre",
    "S05E03 SPHINX Rising",
    "S05E04 Spanakopita",
    "S05E05 O.S.I. Love You",
    "S05E06 Momma's Boys",
    "S05E07 Bot Seeks Bot",
    "S05E08 The Devil's Grip",
    "S06E01 Hostile Makeover",
    "S06E02 Maybe No Go",
    "S06E03 Faking Miracles",
    "S06E04 Rapacity in Blue",
    "S06E05 Tanks for Nuthin",
    "S06E06 It Happening One Night",
    "S06E07 A Party for Tarzan",
    "S06E08 Red Means Stop",
    "S07E01 The Venture Bros. and the Curse of the Haunted Problem",
    "S07E02 The Rorqual Affair",
    "S07E03 Arrears in Science",
    "S07E04 The High Coast of Loathing",
    "S07E05 The Inamorata Consequence",
    "S07E06 The Bellicose Proxy",
    "S07E07 The Unicorn in Captivity",
    "S07E08 The Terminus Mandate",
    "S07E09 The Forecast Manufacturer",
    "S07E10 The Saphrax Protocol",
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
    const frameNumber = Math.floor(Math.random() * 10) + 1; // Random number between 1 and 10
    const formattedNumber = String(frameNumber).padStart(3, '0'); // Format as "001" to "010"
    return `frame_${formattedNumber}.png`;
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