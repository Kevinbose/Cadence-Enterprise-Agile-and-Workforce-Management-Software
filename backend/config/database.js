const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');
const path = require('path');

const envFile =
  process.env.NODE_ENV === 'production'
    ? '.env.production'
    : '.env.local';

dotenv.config({ path: path.resolve(__dirname, '..', envFile) });

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    dialect: 'mysql',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    define: {
      timestamps: true,
      underscored: true,
    },
  }
);

module.exports = { sequelize };
