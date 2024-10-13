// List of shows, links to their respective games, and their high score keys
const shows = [
    { name: 'The Venture Bros.', link: '../venturebrosguesser/index.html', highScoreKey: 'highScore_VentureBros' },
    { name: 'Gravity Falls', link: '../gravityfallsguesser/index.html', highScoreKey: 'highScore_GravityFalls' },
    { name: 'Twin Peaks', link: '../twinpeaksguesser/index.html', highScoreKey: 'highScore_TwinPeaks' },
    { name: 'Saw', link: '../sawguesser/index.html', highScoreKey: 'highScore_Saw' },
    // Add more shows as needed
];

// Sort shows alphabetically by name
shows.sort((a, b) => a.name.localeCompare(b.name));