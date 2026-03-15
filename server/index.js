const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();

// Подключение к PostgreSQL
const pool = new Pool({
  user: "postgres", 
  host: "localhost",
  database: "investor_social",
  password: "1510",
  port: 5432,
});

// Middleware
app.use(cors());
app.use(express.json());



app.get('/api/ai_models', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM ai_models ORDER BY id DESC');
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  });
  
  app.post("/api/ai_models", async (req, res) => {
    try {
      const { name, description } = req.body;
      const newModel = await pool.query(
        "INSERT INTO ai_models (name, description) VALUES ($1, $2) RETURNING *",
        [name, description]
      );
      res.json(newModel.rows[0]);
    } catch (err) {
      console.error(err.message);
      res.status(500).send("Ошибка сервера");
    }
  });

app.delete('/api/ai_models/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await pool.query('DELETE FROM ai_models WHERE id = $1', [id]);
      res.status(200).json({ message: 'Модель удалена' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  });

app.put('/api/ai_models/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description } = req.body;
      
      const result = await pool.query(
        'UPDATE ai_models SET name = $1, description = $2 WHERE id = $3 RETURNING *',
        [name, description, id]
      );
      
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  });
  


// Запуск сервера
app.listen(5000, () => {
  console.log("Сервер запущен на порту 5000");
});