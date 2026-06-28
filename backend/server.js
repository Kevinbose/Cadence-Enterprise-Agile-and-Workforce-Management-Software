const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

const envFile =
  process.env.NODE_ENV === 'production'
    ? '.env.production'
    : '.env.local';

dotenv.config({ path: path.resolve(__dirname, envFile) });

const { sequelize } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true,
  })
);

app.get('/api/v1/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Yakkay Tech Agile Platform API is running',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
});

const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connection established successfully.');

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
    });
  } catch (error) {
    console.error('Unable to connect to the database:', error.message);
    process.exit(1);
  }
};

startServer();

module.exports = app;
