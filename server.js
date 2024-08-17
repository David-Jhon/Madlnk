const express = require('express');
const path = require('path');

const app = express();

app.use(express.static(path.join(__dirname, 'page')));

app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'page', 'index.html'));
});

const startTime = Date.now();

app.get("/uptime", (req, res) => {
  const currentTime = Date.now();
  const uptimeMilliseconds = currentTime - startTime;
  const uptimeSeconds = Math.floor(uptimeMilliseconds / 1000);
  const uptimeMinutes = Math.floor(uptimeSeconds / 60);
  const uptimeHours = Math.floor(uptimeMinutes / 60);
  const uptimeDays = Math.floor(uptimeHours / 24);
  const remainingHours = uptimeHours % 24;
  const remainingMinutes = uptimeMinutes % 60;
  const remainingSeconds = uptimeSeconds % 60;

  const uptimeString = `
    <h2>Bot's Uptime:</h2>
      <p>${uptimeDays} days, ${remainingHours} hours, ${remainingMinutes} minutes, ${remainingSeconds} seconds<p>
      <p>(Started at: ${new Date(startTime).toLocaleString()})</p>
  `;

  res.set('Content-Type', 'text/html');
  res.send(uptimeString);
});

module.exports = app
