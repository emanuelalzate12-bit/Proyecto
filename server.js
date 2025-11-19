// server.js

// --- 1. Importaciones de Módulos ---
// Se importan todas las librerías (paquetes) que el servidor necesita para funcionar.
import express from 'express';        // El framework principal para crear el servidor y las rutas de la API.
import mysql from 'mysql2';           // El "driver" o conector para hablar con la base de datos MySQL.
import path from 'path';              // Una utilidad de Node.js para trabajar con rutas de archivos (ej. 'public/img/foto.jpg').
import multer from 'multer';          // Middleware especializado en manejar la subida de archivos.
import cors from 'cors';              // Middleware de seguridad para permitir que tu frontend (en otro puerto) pueda hacerle peticiones a este servidor.
import { fileURLToPath } from 'url';  // Herramienta para obtener la ruta del archivo actual.
import fs from 'fs';                  // Módulo "File System" para interactuar con los archivos del servidor (crear carpetas, borrar archivos).

// --- 2. Configuración Inicial de Express ---
const app = express(); // Se crea la aplicación del servidor. 'app' es el objeto principal.
const port = 3000;     // Se define el puerto donde el servidor escuchará las peticiones.

// Configuración de CORS para permitir peticiones desde el servidor de desarrollo de Vite
// --- 3. Configuración de CORS (Cross-Origin Resource Sharing) ---
// Esto es crucial para que el frontend (que corre en http://localhost:5173) pueda comunicarse con el backend (en http://localhost:3000).
const corsOptions = {
  origin: 'http://localhost:5173', // El origen de tu frontend
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions)); // Se aplica la configuración de CORS a todas las rutas del servidor.

// --- 4. Configuración de Rutas y Directorios ---
// Obtiene la ruta del archivo actual y su directorio. Necesario para construir rutas absolutas.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Asegurarse de que el directorio de subida de imágenes exista
// Se comprueba si la carpeta para guardar imágenes ('public/img') existe. Si no, se crea.
const uploadDir = path.join(__dirname, 'public', 'img');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true }); // 'recursive: true' asegura que se creen las carpetas anidadas si es necesario.
}

// Conectar a la base de datos MySQL de XAMPP
// --- 5. Conexión a la Base de Datos MySQL ---
// Se crea un "pool" de conexiones, que es más eficiente que abrir y cerrar una conexión para cada consulta.
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

// --- 6. Middlewares Generales de Express ---
// Middleware para que Express entienda los datos que llegan en formato JSON en el cuerpo de las peticiones (ej. en un POST o PUT).
app.use(express.json()); // Permite a Express parsear cuerpos de petición en formato JSON.

// --- Configuración de Multer para subida de archivos ---
// --- 7. Configuración de Multer para Subida de Archivos ---
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Los archivos se guardarán en la carpeta 'public/img'
        // Define dónde se guardarán los archivos: en la carpeta 'public/img'.
        cb(null, 'public/img/');
    },
    filename: function (req, file, cb) {
        // Usamos el nombre original del archivo, pero con un timestamp para evitar sobreescribir
        // Define cómo se nombrará el archivo para evitar que se sobreescriban si tienen el mismo nombre.
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        // Se le añade un sufijo único basado en la fecha y un número aleatorio.
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// --- API Endpoints ---

// --- 8. API Endpoints (Rutas de la API) ---
// Aquí se define qué hace el servidor cuando recibe una petición a una URL específica (ej. GET a /api/games).

// Endpoint para obtener TODOS los juegos
app.get('/api/games', async (req, res) => {
    try {
        const [results] = await db.promise().query("SELECT * FROM juegos ORDER BY nombre"); // Ejecuta una consulta SQL para seleccionar todos los juegos y los ordena por nombre.
        res.json({ message: "success", data: results });
    } catch (err) {
        console.error("Error en /api/games:", err);
        res.status(500).json({ error: err.message });
    }
});

// Endpoint para obtener solo los juegos FAVORITOS
app.get('/api/games/favorites', async (req, res) => {
    try {
        // La consulta SQL filtra los juegos donde el campo 'favorito' es igual a 1.
        const [results] = await db.promise().query("SELECT * FROM juegos WHERE favorito = 1 ORDER BY nombre");
        res.json({ message: "success", data: results });
    } catch (err) {
        console.error("Error en /api/games/favorites:", err);
        res.status(500).json({ error: err.message });
    }
});


// Endpoint para MARCAR/DESMARCAR un juego como favorito (Usa PUT para actualizar)
app.put('/api/games/:id/favorite', async (req, res) => {
    const isFavoriteValue = req.body.favorito ? 1 : 0; // Convierte el valor booleano (true/false) que llega del frontend a 1 o 0 para la base de datos.
    try {
        // Actualiza el campo 'favorito' del juego con el ID especificado en la URL.
        const [results] = await db.promise().query("UPDATE juegos SET favorito = ? WHERE id = ?", [isFavoriteValue, req.params.id]);
        res.json({ message: "success", changes: results.affectedRows });
    } catch (err) {
        console.error("Error en /api/games/:id/favorite:", err);
        res.status(500).json({ error: err.message });
    }
});

// Endpoint para SUBIR una imagen. Este es un paso intermedio.
app.post('/api/upload', upload.single('image'), (req, res) => {
    // 'upload.single('image')' es el middleware de Multer que procesa el archivo.
    if (!req.file) {
        return res.status(400).json({ error: 'No se subió ningún archivo.' });
    }
    // Si la subida es exitosa, devuelve la ruta relativa de la imagen. El frontend usará esta ruta para luego crear el juego.
    // Devolvemos la ruta relativa de la imagen para guardarla en la base de datos
    res.status(200).json({ imageUrl: `img/${req.file.filename}` });
});

// Endpoint para crear un nuevo juego
app.post('/api/games', async (req, res) => {
    const { nombre, imagen_url } = req.body;
    if (!nombre || !imagen_url) { // Validación básica de los datos de entrada.
        return res.status(400).json({ error: 'El nombre y la URL de la imagen son requeridos.' });
    }

    try {
        // Inserta un nuevo registro en la tabla 'juegos'. Por defecto, no es favorito (0).
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
// Endpoint para ELIMINAR un juego (Usa DELETE)
app.delete('/api/games/:id', async (req, res) => {
    const { id } = req.params; // Obtiene el ID de la URL.

    try {
        // 1. Obtener la ruta de la imagen antes de borrar el registro
        // Antes de borrar de la BD, busca la ruta de la imagen para poder borrar el archivo.
        const [gameResult] = await db.promise().query("SELECT imagen_url FROM juegos WHERE id = ?", [id]);

        if (gameResult.length === 0) { // Si no se encuentra el juego, devuelve un error 404.
            return res.status(404).json({ error: 'Juego no encontrado.' });
        }

        // 2. Eliminar el registro de la base de datos
        const [deleteResult] = await db.promise().query("DELETE FROM juegos WHERE id = ?", [id]);

        if (deleteResult.affectedRows > 0) { // Si se borró de la BD, ahora borra el archivo de imagen del servidor.
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

// Endpoint para ACTUALIZAR el nombre de un juego (Usa PUT)
app.put('/api/games/:id', async (req, res) => {
    const { id } = req.params;
    const { nombre } = req.body;

    if (!nombre) { // Validación básica.
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

// Endpoint para obtener TODOS los amigos
app.get('/api/friends', async (req, res) => {
    try {
        // Ejecuta una consulta SQL para seleccionar todos los amigos y los ordena por nombre.
        const [results] = await db.promise().query("SELECT * FROM amigos ORDER BY nombre"); 
        res.json({ message: "success", data: results });
    } catch (err) {
        console.error("Error en GET /api/friends:", err);
        res.status(500).json({ error: err.message });
    }
});

// Endpoint para CREAR un nuevo amigo (Usa POST)
app.post('/api/friends', async (req, res) => {
    const { nombre } = req.body;
    if (!nombre) { // Validación básica.
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

// Endpoint para ELIMINAR un amigo (Usa DELETE)
app.delete('/api/friends/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // Elimina el registro del amigo de la base de datos.
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

// Endpoint para ACTUALIZAR el nombre de un amigo (Usa PUT)
app.put('/api/friends/:id', async (req, res) => {
    const { id } = req.params;
    const { nombre } = req.body;

    if (!nombre) { // Validación básica.
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

// --- 9. Servir Archivos Estáticos ---
// Hace que la carpeta 'public' sea accesible desde el navegador.
// Así, si una imagen está en 'public/img/foto.jpg', se puede ver en 'http://localhost:3000/img/foto.jpg'.
// Esto debe ir DESPUÉS de definir las rutas de la API para evitar conflictos.
app.use(express.static('public')); 

// Iniciar el servidor
// --- 10. Iniciar el Servidor ---
app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
    // Mensaje para confirmar que la base de datos está lista
    db.promise().query('SELECT 1').then(() => {
        console.log('Conexión con la base de datos MySQL establecida.');
    }).catch(err => {
        console.error('Error al conectar con la base de datos MySQL:', err.message);
    });
});

// --- 11. Conexión a Supabase (PostgreSQL) ---
// Esta sección parece ser un resto de otro desarrollo o una funcionalidad futura.
// Se conecta a una base de datos PostgreSQL en Supabase, pero NINGUNO de los endpoints de la API la utiliza.
import dotenv from 'dotenv';
import pkg from 'pg';

dotenv.config();

const { Client } = pkg;

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