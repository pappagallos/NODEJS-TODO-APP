const mysql = require('mysql2/promise');

const pool = mysql.createPool({
	host: 'localhost',
	user: 'root',
	password: 'edith123',
	database: 'edith',
	connectionLimit: 20,
});

module.exports = pool;