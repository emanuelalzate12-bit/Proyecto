// server.js

import express from 'express';
import mysql from 'mysql2';
import path from 'path';
import multer from 'multer';
import cors from 'cors';
import { fileURLToPath } from 'url';
import fs from 'fs';

const app = express();
const port = 3000;

// Configuración de CORS para permitir peticiones desde el servidor de desarrollo de Vite
const corsOptions = {
  origin: 'http://localhost:5173', // El origen de tu frontend
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Asegurarse de que el directorio de subida de imágenes exista
const uploadDir = path.join(__dirname, 'public', 'img');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Conectar a la base de datos MySQL de XAMPP
const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    port: 3306, // Añade esta línea para ser explícito
    password: '',
    database: 'libreria',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Middleware para poder leer JSON en las peticiones y para servir archivos estáticos
app.use(express.json());

// --- Configuración de Multer para subida de archivos ---
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Los archivos se guardarán en la carpeta 'public/img'
        cb(null, 'public/img/');
    },
    filename: function (req, file, cb) {
        // Usamos el nombre original del archivo, pero con un timestamp para evitar sobreescribir
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// --- API Endpoints ---

// Endpoint para obtener todos los juegos
app.get('/api/games', async (req, res) => {
    try {
        const [results] = await db.promise().query("SELECT * FROM juegos ORDER BY nombre");
        res.json({ message: "success", data: results });
    } catch (err) {
        console.error("Error en /api/games:", err);
        res.status(500).json({ error: err.message });
    }
});

// Endpoint para obtener solo los juegos favoritos
app.get('/api/games/favorites', async (req, res) => {
    try {
        const [results] = await db.promise().query("SELECT * FROM juegos WHERE favorito = 1 ORDER BY nombre");
        res.json({ message: "success", data: results });
    } catch (err) {
        console.error("Error en /api/games/favorites:", err);
        res.status(500).json({ error: err.message });
    }
});


// Endpoint para actualizar el estado de favorito
app.put('/api/games/:id/favorite', async (req, res) => {
    const isFavoriteValue = req.body.favorito ? 1 : 0;
    try {
        const [results] = await db.promise().query("UPDATE juegos SET favorito = ? WHERE id = ?", [isFavoriteValue, req.params.id]);
        res.json({ message: "success", changes: results.affectedRows });
    } catch (err) {
        console.error("Error en /api/games/:id/favorite:", err);
        res.status(500).json({ error: err.message });
    }
});

// Endpoint para subir una imagen
app.post('/api/upload', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No se subió ningún archivo.' });
    }
    // Devolvemos la ruta relativa de la imagen para guardarla en la base de datos
    res.status(200).json({ imageUrl: `img/${req.file.filename}` });
});

// Endpoint para crear un nuevo juego
app.post('/api/games', async (req, res) => {
    const { nombre, imagen_url } = req.body;
    if (!nombre || !imagen_url) {
        return res.status(400).json({ error: 'El nombre y la URL de la imagen son requeridos.' });
    }

    try {
        const [results] = await db.promise().query(
            "INSERT INTO juegos (nombre, imagen_url, favorito) VALUES (?, ?, 0)",
            [nombre, imagen_url]
        );
        res.status(201).json({ message: "Juego creado", id: results.insertId, nombre, imagen_url });
    } catch (err) {
        console.error("Error en POST /api/games:", err);
        res.status(500).json({ error: err.message });
    }
});

// Endpoint para eliminar un juego
app.delete('/api/games/:id', async (req, res) => {
    const { id } = req.params;

    try {
        // 1. Obtener la ruta de la imagen antes de borrar el registro
        const [gameResult] = await db.promise().query("SELECT imagen_url FROM juegos WHERE id = ?", [id]);

        if (gameResult.length === 0) {
            return res.status(404).json({ error: 'Juego no encontrado.' });
        }

        // 2. Eliminar el registro de la base de datos
        const [deleteResult] = await db.promise().query("DELETE FROM juegos WHERE id = ?", [id]);

        if (deleteResult.affectedRows > 0) {
            // 3. Si se borró, eliminar el archivo de imagen del servidor
            const imageUrl = gameResult[0].imagen_url;
            const imagePath = path.join(__dirname, 'public', imageUrl);
            fs.unlink(imagePath, (err) => {
                if (err) console.error(`Error al eliminar el archivo de imagen ${imagePath}:`, err);
            });
            res.status(200).json({ message: 'Juego eliminado correctamente.' });
        }
    } catch (err) {
        console.error(`Error en DELETE /api/games/${id}:`, err);
        res.status(500).json({ error: err.message });
    }
});

// Endpoint para actualizar el nombre de un juego
app.put('/api/games/:id', async (req, res) => {
    const { id } = req.params;
    const { nombre } = req.body;

    if (!nombre) {
        return res.status(400).json({ error: 'El nombre es requerido.' });
    }

    try {
        const [results] = await db.promise().query("UPDATE juegos SET nombre = ? WHERE id = ?", [nombre, id]);
        if (results.affectedRows > 0) {
            res.status(200).json({ message: 'Juego actualizado correctamente.' });
        } else {
            res.status(404).json({ error: 'Juego no encontrado.' });
        }
    } catch (err) {
        console.error(`Error en PUT /api/games/${id}:`, err);
        res.status(500).json({ error: err.message });
    }
});

// Endpoint para obtener todos los amigos
app.get('/api/friends', async (req, res) => {
    try {
        const [results] = await db.promise().query("SELECT * FROM amigos ORDER BY nombre");
        res.json({ message: "success", data: results });
    } catch (err) {
        console.error("Error en GET /api/friends:", err);
        res.status(500).json({ error: err.message });
    }
});

// Endpoint para crear un nuevo amigo
app.post('/api/friends', async (req, res) => {
    const { nombre } = req.body;
    if (!nombre) {
        return res.status(400).json({ error: 'El nombre es requerido.' });
    }

    try {
        const [results] = await db.promise().query(
            "INSERT INTO amigos (nombre) VALUES (?)",
            [nombre]
        );
        res.status(201).json({ message: "Amigo creado", id: results.insertId, nombre });
    } catch (err) {
        console.error("Error en POST /api/friends:", err);
        res.status(500).json({ error: err.message });
    }
});

// Endpoint para eliminar un amigo
app.delete('/api/friends/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [deleteResult] = await db.promise().query("DELETE FROM amigos WHERE id = ?", [id]);

        if (deleteResult.affectedRows > 0) {
            res.status(200).json({ message: 'Amigo eliminado correctamente.' });
        } else {
            res.status(404).json({ error: 'Amigo no encontrado.' });
        }
    } catch (err) {
        console.error(`Error en DELETE /api/friends/${id}:`, err);
        res.status(500).json({ error: err.message });
    }
});

// Endpoint para actualizar el nombre de un amigo
app.put('/api/friends/:id', async (req, res) => {
    const { id } = req.params;
    const { nombre } = req.body;

    if (!nombre) {
        return res.status(400).json({ error: 'El nombre es requerido.' });
    }

    try {
        const [results] = await db.promise().query("UPDATE amigos SET nombre = ? WHERE id = ?", [nombre, id]);
        if (results.affectedRows > 0) {
            res.status(200).json({ message: 'Amigo actualizado correctamente.' });
        } else {
            res.status(404).json({ error: 'Amigo no encontrado.' });
        }
    } catch (err) {
        console.error(`Error en PUT /api/friends/${id}:`, err);
        res.status(500).json({ error: err.message });
    }
});

// Servimos la carpeta 'public' para que las imágenes sean accesibles desde el navegador.
// Esto debe ir DESPUÉS de definir las rutas de la API.
app.use(express.static('public'));

// Iniciar el servidor
app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
    // Mensaje para confirmar que la base de datos está lista
    db.promise().query('SELECT 1').then(() => {
        console.log('Conexión con la base de datos MySQL establecida.');
    }).catch(err => {
        console.error('Error al conectar con la base de datos MySQL:', err.message);
    });
});

require('dotenv').config(); // Carga las variables del archivo .env

const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

client.connect()
  .then(() => console.log('✅ Conectado a Supabase'))
  .catch(err => console.error('❌ Error de conexión', err));

export default client;

