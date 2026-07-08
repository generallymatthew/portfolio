const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const scholarshipsPath = path.join(__dirname, 'data', 'scholarships.json');
const scholarships = JSON.parse(fs.readFileSync(scholarshipsPath, 'utf-8'));

app.get('/api/scholarships', (req, res) => {
  res.json(scholarships);
});

app.get('/api/scholarships/:id', (req, res) => {
  const scholarship = scholarships.find(s => s.id === req.params.id);
  if (!scholarship) {
    return res.status(404).json({ error: 'Scholarship not found' });
  }
  res.json(scholarship);
});

app.listen(PORT, () => {
  console.log(`Scholarship server running at http://localhost:${PORT}`);
});
