const express = require('express');
const app = express();
const PORT = 5000;

app.get('/', (req, res) => {
  res.send('LMS API is running');
});


app.get('/courses', (req, res) => {
    res.send('Courses will be here');
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});