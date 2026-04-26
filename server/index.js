const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || "your_secret_key_here_change_it";

const pool = new Pool({
    user: "postgres",
    host: "localhost",
    database: "investor_social",
    password: "1510",
    port: 5432,
});

app.use(cors());
app.use(express.json());


// Регистрация
app.post("/api/register", async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Проверка наличия пользователя
        const existingUser = await pool.query(
            "SELECT * FROM users WHERE username = $1 OR email = $2",
            [username, email]
        );

        if (existingUser.rows.length > 0) {
            return res.status(400).json({ error: "Пользователь уже существует" });
        }

        // Хеширование пароля
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Создание пользователя
        const result = await pool.query(
            "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email",
            [username, email, passwordHash]
        );

        const user = result.rows[0];

        // Создаем портфолио для нового пользователя
        await pool.query(
            "INSERT INTO portfolios (name, user_id) VALUES ($1, $2)",
            ["Мои инвестиции", user.id]
        );

        // Создаем JWT токен
        const token = jwt.sign(
            { userId: user.id, username: user.username },
            JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Ошибка сервера" });
    }
});
app.get('/api/assets/:portfolioId', authenticateToken, async (req, res) => {
    try {
        const { portfolioId } = req.params;
        const result = await pool.query(
            `SELECT a.* FROM assets a 
       JOIN portfolios p ON a.portfolio_id = p.id 
       WHERE a.portfolio_id = $1 AND p.user_id = $2 
       ORDER BY a.created_at DESC`,
            [portfolioId, req.user.userId]
        );

        // Гарантируем, что возвращаем массив
        res.json(result.rows || []);
    } catch (err) {
        console.error(err);
        res.status(500).json([]); // Возвращаем пустой массив при ошибке
    }
});

// Логин
app.post("/api/login", async (req, res) => {
    try {
        const { username, password } = req.body;

        // Поиск пользователя
        const result = await pool.query(
            "SELECT * FROM users WHERE username = $1 OR email = $1",
            [username]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: "Неверное имя пользователя или пароль" });
        }

        const user = result.rows[0];

        // Проверка пароля
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: "Неверное имя пользователя или пароль" });
        }

        // Создаем JWT токен
        const token = jwt.sign(
            { userId: user.id, username: user.username },
            JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Ошибка сервера" });
    }
});

// Middleware для проверки токена
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: "Требуется авторизация" });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: "Недействительный токен" });
        }
        req.user = user;
        next();
    });
}


// Получить портфолио текущего пользователя
app.get('/api/portfolios', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM portfolios WHERE user_id = $1 ORDER BY created_at DESC',
            [req.user.userId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Создать портфолио
app.post("/api/portfolios", authenticateToken, async (req, res) => {
    try {
        const { name } = req.body;
        const result = await pool.query(
            "INSERT INTO portfolios (name, user_id) VALUES ($1, $2) RETURNING *",
            [name, req.user.userId]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Ошибка сервера" });
    }
});

// Удалить портфолио
app.delete('/api/portfolios/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM portfolios WHERE id = $1 AND user_id = $2', [id, req.user.userId]);
        res.json({ message: 'Портфолио удалено' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получить активы (только для портфолио текущего пользователя)
app.get('/api/assets/:portfolioId', authenticateToken, async (req, res) => {
    try {
        const { portfolioId } = req.params;
        const result = await pool.query(
            `SELECT a.* FROM assets a 
       JOIN portfolios p ON a.portfolio_id = p.id 
       WHERE a.portfolio_id = $1 AND p.user_id = $2 
       ORDER BY a.created_at DESC`,
            [portfolioId, req.user.userId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Добавить актив
app.post("/api/assets", authenticateToken, async (req, res) => {
    try {
        const { portfolio_id, asset_type, symbol, name, quantity, purchase_price, current_price, purchase_date, notes } = req.body;

        // Проверяем, что портфолио принадлежит пользователю
        const portfolioCheck = await pool.query(
            'SELECT id FROM portfolios WHERE id = $1 AND user_id = $2',
            [portfolio_id, req.user.userId]
        );

        if (portfolioCheck.rows.length === 0) {
            return res.status(403).json({ error: "Доступ запрещен" });
        }

        const result = await pool.query(
            `INSERT INTO assets (portfolio_id, asset_type, symbol, name, quantity, purchase_price, current_price, purchase_date, notes) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [portfolio_id, asset_type, symbol, name, quantity, purchase_price, current_price || null, purchase_date || null, notes || null]
        );

        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Удалить актив
app.delete('/api/assets/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query(
            `DELETE FROM assets WHERE id = $1 AND portfolio_id IN 
       (SELECT id FROM portfolios WHERE user_id = $2)`,
            [id, req.user.userId]
        );
        res.json({ message: 'Актив удален' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получить данные пользователя
app.get('/api/me', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, username, email, avatar, created_at FROM users WHERE id = $1',
            [req.user.userId]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.listen(5000, () => {
    console.log("Сервер запущен на порту 5000");
});