const Pool = require("pg").Pool;

const pool = new Pool({
    user: "postgres",
    password: "1510",
    host: "localhost",
    port: 5432,
    database: "investor_social"
});

module.exports = pool;