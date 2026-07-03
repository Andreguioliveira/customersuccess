const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');
const USERS_FILE = path.join(__dirname, 'users.json');

app.use(bodyParser.json());
app.use(session({
    secret: 'refuturiza-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // In production use true with HTTPS
}));

// Auth Middleware
function isAuthenticated(req, res, next) {
    if (req.session.user) return next();
    res.status(401).json({ error: 'Unauthorized' });
}

function isAdmin(req, res, next) {
    if (req.session.user && req.session.user.role === 'admin') return next();
    res.status(403).json({ error: 'Forbidden' });
}

// Static files (except dashboard which is protected)
app.use(express.static(__dirname, {
    index: false,
    setHeaders: (res, path) => {
        if (path.endsWith('.html') && !path.includes('login.html')) {
            // We'll handle HTML routing specifically
        }
    }
}));

// Auth Endpoints
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    const user = users.find(u => u.username === username && u.password === password);
    
    if (user) {
        req.session.user = { username: user.username, role: user.role };
        res.json({ message: 'Logged in', user: req.session.user });
    } else {
        res.status(401).json({ error: 'Credenciais inválidas' });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ message: 'Logged out' });
});

app.get('/api/me', (req, res) => {
    res.json(req.session.user || null);
});

// Accounts API
app.get('/api/accounts', isAuthenticated, (req, res) => {
    if (!fs.existsSync(DATA_FILE)) return res.json([]);
    fs.readFile(DATA_FILE, 'utf8', (err, data) => {
        if (err) return res.status(500).send('Error reading data');
        res.json(JSON.parse(data || '[]'));
    });
});

app.post('/api/accounts', isAuthenticated, (req, res) => {
    if (!Array.isArray(req.body)) return res.status(400).send('Invalid data format');
    
    // Server-side validation and sanitization
    const sanitized = req.body.filter(row => Array.isArray(row) && row.length >= 1)
        .map(row => {
            // Ensure exact column count or at least minimal identification
            return row.map(cell => {
                if (typeof cell === 'string') return cell.substring(0, 200).trim();
                if (typeof cell === 'number') return cell;
                return '';
            });
        });

    fs.writeFile(DATA_FILE, JSON.stringify(sanitized, null, 2), (err) => {
        if (err) return res.status(500).send('Error saving data');
        res.send('Saved');
    });
});

// Admin API
app.post('/api/admin/change-password', isAdmin, (req, res) => {
    const { newPassword } = req.body;
    if (!newPassword) return res.status(400).send('Password required');
    
    const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    const adminIdx = users.findIndex(u => u.username === req.session.user.username);
    if (adminIdx > -1) {
        users[adminIdx].password = newPassword;
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
        res.send('Password changed');
    } else {
        res.status(404).send('User not found');
    }
});

// Page Routing
app.get('/', (req, res) => {
    if (req.session.user) {
        res.sendFile(path.join(__dirname, 'cs-dashboard.html'));
    } else {
        res.redirect('/login');
    }
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log('SERVER_STARTED_ON_PORT_' + PORT);
});
