const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const app = express();
const PORT = 3001;

// Middleware
app.use(express.json());
app.use(express.static('.'));

// Save data endpoint
app.post('/save-data', async (req, res) => {
  try {
    const data = req.body;
    await fs.writeFile('data.json', JSON.stringify(data, null, 2));
    res.json({ success: true, message: 'Data saved successfully' });
  } catch (error) {
    console.error('Error saving data:', error);
    res.status(500).json({ success: false, message: 'Error saving data' });
  }
});

// Get data endpoint
app.get('/get-data', async (req, res) => {
  try {
    const data = await fs.readFile('data.json', 'utf8');
    res.json(JSON.parse(data));
  } catch (error) {
    console.error('Error reading data:', error);
    res.status(500).json({ success: false, message: 'Error reading data' });
  }
});

// Serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log('Backgammon Tournament Manager is ready!');
});