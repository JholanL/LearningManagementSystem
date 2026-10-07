require('dotenv').config();

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is not defined. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`)))
  .catch((err) => {
    console.error('Failed to connect to MongoDB:', err.message);
    process.exit(1);
  });
