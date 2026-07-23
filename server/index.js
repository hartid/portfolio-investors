const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const speakeasy = require("speakeasy");
const QRCode = require("qrcode");
require("dotenv").config();

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || "your_secret_key_here";

const pool = new Pool({
    user: "postgres",
    host: "localhost",
    database: "investor_social",
    password: "1510",
    port: 5432,
});

app.use(cors());
app.use(express.json());

// ============ MIDDLEWARE ============
const authenticateToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ error: "Требуется авторизация" });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: "Недействительный токен" });
        req.user = user;
        next();
    });
};

// ============ АВТОРИЗАЦИЯ ============
app.post("/api/register", async (req, res) => {
    try {
        const { username, email, password } = req.body;

        const existing = await pool.query(
            "SELECT * FROM users WHERE username = $1 OR email = $2",
            [username, email]
        );
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: "Пользователь уже существует" });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const result = await pool.query(
            "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email",
            [username, email, passwordHash]
        );

        await pool.query(
            "INSERT INTO portfolios (name, user_id) VALUES ($1, $2)",
            ["Мои инвестиции", result.rows[0].id]
        );

        const token = jwt.sign(
            { userId: result.rows[0].id, username: result.rows[0].username },
            JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.json({ token, user: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: "Ошибка сервера" });
    }
});

app.post("/api/login", async (req, res) => {
    try {
        const { username, password, twoFactorCode } = req.body;

        const result = await pool.query(
            "SELECT * FROM users WHERE username = $1 OR email = $1",
            [username]
        );
        if (result.rows.length === 0) {
            return res.status(401).json({ error: "Неверные учетные данные" });
        }

        const user = result.rows[0];
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: "Неверные учетные данные" });
        }

        // 2FA проверка
        if (user.two_factor_enabled) {
            if (!twoFactorCode) {
                return res.status(200).json({ requiresTwoFactor: true, userId: user.id });
            }

            const isValid = speakeasy.totp.verify({
                secret: user.two_factor_secret,
                encoding: "base32",
                token: twoFactorCode,
                window: 1
            });

            if (!isValid) {
                return res.status(401).json({ error: "Неверный код 2FA" });
            }
        }

        const token = jwt.sign(
            { userId: user.id, username: user.username },
            JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
    } catch (err) {
        res.status(500).json({ error: "Ошибка сервера" });
    }
});

// ============ 2FA ============
app.post("/api/2fa/setup", authenticateToken, async (req, res) => {
    try {
        const secret = speakeasy.generateSecret({ name: `InvestorSocial:${req.user.username}` });
        const backupCodes = Array.from({ length: 10 }, () => Math.random().toString(36).substring(2, 10).toUpperCase());

        await pool.query(
            "UPDATE users SET two_factor_secret = $1, backup_codes = $2 WHERE id = $3",
            [secret.base32, backupCodes, req.user.userId]
        );

        const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);
        res.json({ secret: secret.base32, qrCode: qrCodeUrl, backupCodes });
    } catch (err) {
        res.status(500).json({ error: "Ошибка настройки 2FA" });
    }
});

app.post("/api/2fa/verify", authenticateToken, async (req, res) => {
    try {
        const { token } = req.body;
        const result = await pool.query("SELECT two_factor_secret FROM users WHERE id = $1", [req.user.userId]);

        const verified = speakeasy.totp.verify({
            secret: result.rows[0]?.two_factor_secret,
            encoding: "base32",
            token,
            window: 1
        });

        if (!verified) return res.status(400).json({ error: "Неверный код" });

        await pool.query("UPDATE users SET two_factor_enabled = TRUE WHERE id = $1", [req.user.userId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Ошибка подтверждения" });
    }
});

// ============ ПОРТФОЛИО ============
app.get('/api/portfolios', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM portfolios WHERE user_id = $1 ORDER BY created_at DESC',
            [req.user.userId]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ============ АКТИВЫ ============
app.get('/api/assets/:portfolioId', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT a.* FROM assets a 
             JOIN portfolios p ON a.portfolio_id = p.id 
             WHERE a.portfolio_id = $1 AND p.user_id = $2 
             ORDER BY a.created_at DESC`,
            [req.params.portfolioId, req.user.userId]
        );
        res.json(result.rows || []);
    } catch (err) {
        res.status(500).json([]);
    }
});

app.post("/api/assets", authenticateToken, async (req, res) => {
    try {
        const { portfolio_id, asset_type, symbol, name, quantity, purchase_price, current_price, purchase_date, notes } = req.body;

        const check = await pool.query("SELECT id FROM portfolios WHERE id = $1 AND user_id = $2", [portfolio_id, req.user.userId]);
        if (check.rows.length === 0) {
            return res.status(403).json({ error: "Доступ запрещен" });
        }

        const result = await pool.query(
            `INSERT INTO assets (portfolio_id, asset_type, symbol, name, quantity, purchase_price, current_price, purchase_date, notes) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [portfolio_id, asset_type, symbol, name, quantity, purchase_price, current_price || null, purchase_date || null, notes || null]
        );

        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/assets/:id', authenticateToken, async (req, res) => {
    try {
        await pool.query(
            `DELETE FROM assets WHERE id = $1 AND portfolio_id IN (SELECT id FROM portfolios WHERE user_id = $2)`,
            [req.params.id, req.user.userId]
        );
        res.json({ message: 'Актив удален' });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.post('/api/assets/update-prices', authenticateToken, async (req, res) => {
    try {
        const { prices } = req.body;
        const updates = [];

        for (const item of prices) {
            const result = await pool.query(
                `UPDATE assets SET current_price = $1, updated_at = NOW() 
                 WHERE id = $2 AND portfolio_id IN (SELECT id FROM portfolios WHERE user_id = $3) 
                 RETURNING id, name, current_price`,
                [item.price, item.id, req.user.userId]
            );
            if (result.rows.length > 0) updates.push(result.rows[0]);
        }

        res.json({ updated: updates.length, assets: updates });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка обновления цен' });
    }
});

// ============ ПОЛЬЗОВАТЕЛЬ ============
app.get('/api/me', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, username, email, avatar, created_at, two_factor_enabled FROM users WHERE id = $1',
            [req.user.userId]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ============ ЗАПУСК ============
app.listen(5000, () => {
    console.log("✅ Сервер запущен на порту 5000");
});