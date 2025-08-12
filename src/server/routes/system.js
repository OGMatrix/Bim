const express = require('express');
const { exec } = require('child_process');
const router = express.Router();

router.post('/shutdown', (req, res) => {
  // Only allow shutdown from localhost for security
  if (req.ip !== '127.0.0.1' && req.ip !== '::1') {
    return res.status(403).json({ success: false, message: 'Shutdown can only be initiated from localhost' });
  }

  exec('sudo shutdown -h now', (error, stdout, stderr) => {
    if (error) {
      console.error(`Shutdown error: ${error}`);
      return res.status(500).json({ success: false, message: 'Failed to initiate shutdown' });
    }
    res.json({ success: true, message: 'Shutdown initiated' });
  });
});

module.exports = router;
