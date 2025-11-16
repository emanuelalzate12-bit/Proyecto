import { useState, useEffect } from 'react'
import './App.css'

// Componente para una tarjeta de juego individual
function GameCard({ game, onToggleFavorite }) {
  return (
    <div className="game-card">
      <img 
        src={`/${game.imagen_url}`} 
        alt={game.nombre} 
        onError={(e) => { e.target.onerror = null; e.target.src='/img/placeholder.png' }} 
      />
      <div className="game-title">{game.nombre}</div>
      <button 
        className="btn btn-outline-danger btn-sm btn-fav"
        onClick={() => onToggleFavorite(game.id, !game.favorito)}
      >
        <i className={`bi ${game.favorito ? 'bi-heart-fill' : 'bi-heart'}`}></i>
      </button>
    </div>
  );
}

// Componente para el formulario de añadir juego
function AddGameForm({ onGameAdded }) {
  const [nombre, setNombre] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('Subiendo...');

    if (!nombre || !imageFile) {
      setMessage('Por favor, completa el nombre y selecciona una imagen.');
      return;
    }

    // 1. Subir la imagen
    const formData = new FormData();
    formData.append('image', imageFile);

    try {
      const uploadResponse = await fetch('http://localhost:3000/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) throw new Error('Error al subir la imagen.');

      const { imageUrl } = await uploadResponse.json();

      // 2. Crear el juego en la base de datos con la URL de la imagen
      const gameResponse = await fetch('http://localhost:3000/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nombre, imagen_url: imageUrl }),
      });

      if (!gameResponse.ok) throw new Error('Error al crear el juego.');

      const newGame = await gameResponse.json();
      setMessage(`¡Juego "${newGame.nombre}" añadido!`);
      onGameAdded(newGame); // Llama a la función para actualizar la lista de juegos

      // Limpiar formulario
      setNombre('');
      setImageFile(null);
      e.target.reset();

    } catch (error) {
      setMessage(error.message);
      console.error('Error al añadir juego:', error);
    }
  };

  return null; // Este formulario no se mostrará directamente, lo usaremos en el futuro
}

function App() {
  const [games, setGames] = useState([]);
  const [error, setError] = useState(null);

  // useEffect se ejecuta después de que el componente se renderiza.
  // El array vacío [] al final significa que solo se ejecutará una vez.
  useEffect(() => {
    async function loadGames() {
      try {
        // En desarrollo con Vite, necesitas usar la URL completa del servidor
        const response = await fetch('http://localhost:3000/api/games');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        setGames(result.data);
      } catch (error) {
        console.error('Error al cargar los juegos:', error);
        setError('No se pudieron cargar los juegos. ¿Está el servidor (server.js) corriendo?');
      }
    }

    loadGames();
  }, []); // El array vacío asegura que esto se ejecute solo una vez

  const handleToggleFavorite = async (gameId, newFavoriteStatus) => {
    try {
      const response = await fetch(`http://localhost:3000/api/games/${gameId}/favorite`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ favorito: newFavoriteStatus ? 1 : 0 }),
      });

      if (response.ok) {
        // Actualizar el estado local para que la UI reaccione
        setGames(games.map(game => 
          game.id === gameId ? { ...game, favorito: newFavoriteStatus } : game
        ));
      } else {
        console.error('Falló la actualización en el servidor');
      }
    } catch (error) {
      console.error('Error al actualizar favorito:', error);
    }
  };

  const handleGameAdded = (newGameData) => {
    // Para mostrar el nuevo juego, lo añadimos al estado actual
    // Nota: la API de creación devuelve el juego completo, pero la de listar no.
    // Para ser consistentes, recargamos la lista.
    loadGames();
  };

  return (
    <>
      {/* Formulario para añadir un nuevo juego */}
      <div className="add-game-form mb-4 p-3 border rounded">
        <h4>Añadir Nuevo Juego</h4>
        <form onSubmit={
          async (e) => {
            e.preventDefault();
            const form = e.target;
            const formData = new FormData(form);
            const nombre = formData.get('nombre');
            const imageFile = formData.get('image');

            if (!nombre || !imageFile || imageFile.size === 0) {
              alert('Por favor, completa todos los campos.');
              return;
            }

            try {
              const uploadResponse = await fetch('http://localhost:3000/api/upload', { method: 'POST', body: formData });
              if (!uploadResponse.ok) throw new Error('Error al subir la imagen.');
              const { imageUrl } = await uploadResponse.json();

              const gameResponse = await fetch('http://localhost:3000/api/games', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre, imagen_url: imageUrl }),
              });
              if (!gameResponse.ok) throw new Error('Error al crear el juego.');
              
              handleGameAdded(); // Recargar la lista de juegos
              form.reset();
            } catch (error) {
              console.error('Error al añadir juego:', error);
              alert(error.message);
            }
          }
        }>
          <div className="mb-2"><input type="text" name="nombre" className="form-control" placeholder="Nombre del juego" required /></div>
          <div className="mb-2"><input type="file" name="image" className="form-control" accept="image/*" required /></div>
          <button type="submit" className="btn btn-primary">Añadir Juego</button>
        </form>
      </div>

      {/* Grilla de juegos existentes */}
      <div className="game-grid">
        {error && <p>{error}</p>}
        {games.length > 0 ? (
          games.map(game => (
            <GameCard key={game.id} game={game} onToggleFavorite={handleToggleFavorite} />
          ))
        ) : (
          !error && <p>Cargando juegos...</p>
        )}
      </div>
    </>
  );
}

export default App
