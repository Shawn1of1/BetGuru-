const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');
const axios = require('axios');

const app = express();
const port = 3000;

// Your Odds API key
const apiKey = '92bbd03c8794da8d196c75b16566a403';
const oddsApiUrl = `https://api.the-odds-api.com/v4/sports/odds?regions=uk,us&markets=h2h,ou,corners,btts,ht_ft,goalscorer,starting_lineups&apiKey=${apiKey}`;

// Set up database
const db = new sqlite3.Database('./database/users.db', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            email TEXT UNIQUE,
            phone TEXT,
            gender TEXT,
            age INTEGER
        )`);
    }
});

// Middleware
app.use(express.static(path.join(__dirname, '../public')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Handle registration form submission
app.post('/register', (req, res) => {
    const { name, email, phone, gender, age } = req.body;

    if (!name || !email || !phone || !gender || !age) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    db.run(`INSERT INTO users (name, email, phone, gender, age) VALUES (?, ?, ?, ?, ?)`,
        [name, email, phone, gender, age], function (err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.status(200).json({ message: 'User registered successfully' });
        }
    );
});

// Fetch betting tips and create slips
app.get('/betting-tips', async (req, res) => {
    try {
        const response = await axios.get(oddsApiUrl);
        const oddsData = response.data;

        // Process data to create slips
        const tips = processOddsData(oddsData);
        const slips = createBettingSlips(tips);

        res.json({ slips });
    } catch (error) {
        console.error('Error fetching odds data:', error);
        res.status(500).json({ error: 'Error fetching odds data' });
    }
});

function processOddsData(oddsData) {
    return oddsData.map(match => {
        const h2hMarket = match.bookmakers[0].markets.find(market => market.key === 'h2h');
        const ouMarket = match.bookmakers[0].markets.find(market => market.key === 'ou');
        return {
            match: match.home_team + ' vs ' + match.away_team,
            name: h2hMarket.outcomes[0].name,
            price: h2hMarket.outcomes[0].price,
            overUnder: ouMarket ? ouMarket.outcomes.map(ou => `${ou.name} - ${ou.price}`) : []
        };
    });
}

function createBettingSlips(tips) {
    const slips = [];

    // Create a slip with a mix of different sports and markets
    while (tips.length) {
        const slip = tips.splice(0, 5);
        slips.push(slip);
    }

    return slips;
}

// Fetch starting lineups and substitutes
app.get('/lineups', async (req, res) => {
    try {
        const response = await axios.get(oddsApiUrl);
        const oddsData = response.data;

        const lineups = oddsData.map(match => {
            return {
                teamName: match.home_team,
                starting: match.starting_lineup.home_team.players.map(player => player.name),
                substitutes: match.substitutes.home_team.players.map(player => player.name)
            };
        });

        res.json({ lineups });
    } catch (error) {
        console.error('Error fetching lineups:', error);
        res.status(500).json({ error: 'Error fetching lineups' });
    }
});

// Fetch rare markets
app.get('/rare-markets', async (req, res) => {
    try {
        const response = await axios.get(oddsApiUrl);
        const oddsData = response.data;

        const rareMarkets = oddsData.map(match => {
            const cornersMarket = match.bookmakers[0].markets.find(market => market.key === 'corners');
            return {
                match: match.home_team + ' vs ' + match.away_team,
                description: 'Corners',
                price: cornersMarket ? cornersMarket.outcomes.map(outcome => `${outcome.name} - ${outcome.price}`) : []
            };
        });

        res.json({ markets: rareMarkets });
    } catch (error) {
        console.error('Error fetching rare markets:', error);
        res.status(500).json({ error: 'Error fetching rare markets' });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
