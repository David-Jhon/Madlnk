const express = require('express');
const router = express.Router();

// Login endpoint
router.post('/login', (req, res) => {
    const { username, password } = req.body;

    const adminUsername = process.env.ADMIN_USERNAME;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (username === adminUsername && password === adminPassword) {
        // Set signed cookie
        res.cookie('admin_token', username, {
            maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
            httpOnly: true,
            signed: true,
            secure: false
        });

        res.json({
            success: true,
            message: 'Login successful'
        });
    } else {
        res.status(401).json({
            success: false,
            message: 'Invalid username or password'
        });
    }
});

// Logout endpoint
router.post('/logout', (req, res) => {
    res.clearCookie('admin_token');
    res.json({
        success: true,
        message: 'Logout successful'
    });
});

// Check authentication status
router.get('/check', (req, res) => {
    if (req.signedCookies && req.signedCookies.admin_token) {
        res.json({
            authenticated: true,
            username: req.signedCookies.admin_token
        });
    } else {
        res.json({
            authenticated: false
        });
    }
});

module.exports = router;
