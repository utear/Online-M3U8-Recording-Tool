const express = require('express');
const router = express.Router();
const iptvService = require('../services/iptvService');

// Get all channels
router.get('/channels', async (req, res) => {
    try {
        const channels = iptvService.getChannels();
        res.json(channels);
    } catch (error) {
        console.error('Error getting channels:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Force update channels
router.post('/update', async (req, res) => {
    try {
        await iptvService.updateChannels();
        res.json({ message: 'Channels updated successfully' });
    } catch (error) {
        console.error('Error updating channels:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
