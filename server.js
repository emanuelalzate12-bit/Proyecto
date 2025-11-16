// server.js

import express from 'express';
import mysql from 'mysql2';
import path from 'path';
import multer from 'multer';
import cors from 'cors';
import { fileURLToPath } from 'url';

const app = express();
const port = 3000;
app.use(cors()); // 2. Usar cors como middleware

// Middleware para servir archivos estáticos (tu HTML, CSS, JS del frontend)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname)));
// Middleware para poder leer JSON en las peticiones
app.use(express.json());

// Conectar a la base de datos MySQL de XAMPP
const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'libreria',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

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
