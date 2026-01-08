const express = require('express');
const app = express();

app.get('/test', (req, res) => {
  res.json({ status: 'working' });
});

const server = app.listen(5000, () => {
  console.log('Test server running on port 5000');
});

// Keep alive
setInterval(() => {
  console.log('Server still running...');
}, 5000);
