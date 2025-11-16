import { useState, useEffect } from 'react'
import './App.css'

function GameCard({ game, onToggleFavorite, onDelete, onUpdate }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(game.nombre);

  const handleUpdate = () => {
    if (editedName.trim() === '') {
      alert('El nombre no puede estar vacío.');
      return;
    }
    onUpdate(game.id, editedName);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedName(game.nombre); // Reset to original name
    setIsEditing(false);
  };

  return (
    <div className="game-card">
      <img 
        src={game.imagen_url} 
        alt={game.nombre} 
        onError={(e) => { e.target.onerror = null; e.target.src='img/placeholder.png' }} 
      />
      {isEditing ? (
        <div className="my-2">
          <input
            type="text"
            className="form-control form-control-sm"
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleUpdate()}
          />
        </div>
      ) : (
        <div className="game-title">{game.nombre}</div>
      )}
      <div className="game-card-actions">
        {isEditing ? (
          <>
            <button className="btn btn-success btn-sm" onClick={handleUpdate}><i className="bi bi-check-lg"></i></button>
            <button className="btn btn-secondary btn-sm" onClick={handleCancel}><i className="bi bi-x-lg"></i></button>
          </>
        ) : (
          <>
            <button className="btn btn-outline-danger btn-sm" onClick={() => onToggleFavorite(game.id, !game.favorito)}>
              <i className={`bi ${game.favorito ? 'bi-heart-fill' : 'bi-heart'}`}></i>
            </button>
            <button className="btn btn-outline-secondary btn-sm" onClick={() => setIsEditing(true)}>
              <i className="bi bi-pencil"></i>
            </button>
            <button className="btn btn-outline-secondary btn-sm" onClick={() => onDelete(game.id)}>
              <i className="bi bi-trash"></i>
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function AddGameForm({ onGameAdded }) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const form = e.target;
    const formData = new FormData(form);
    const nombre = formData.get('nombre');

    if (!nombre || !formData.get('image') || formData.get('image').size === 0) {
      alert('Por favor, completa todos los campos.');
      setIsSubmitting(false);
      return;
    }

    try {
      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) throw new Error('Error al subir la imagen.');

      const { imageUrl } = await uploadResponse.json();

      // 2. Crear el juego en la base de datos con la URL de la imagen
      const gameResponse = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nombre, imagen_url: imageUrl }),
      });

      if (!gameResponse.ok) throw new Error('Error al guardar el juego en la base de datos.');

      // Limpiar formulario
      form.reset();
      onGameAdded(); // Llama a la función para actualizar la lista de juegos

    } catch (error) {
      console.error('Error al añadir juego:', error);
      alert(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="add-game-form mb-4 p-3 border rounded">
      <h4>Añadir Nuevo Juego</h4>
      <form onSubmit={handleSubmit}>
        <div className="mb-2"><input type="text" name="nombre" className="form-control" placeholder="Nombre del juego" required disabled={isSubmitting} /></div>
        <div className="mb-2"><input type="file" name="image" className="form-control" accept="image/*" required disabled={isSubmitting} /></div>
        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>{isSubmitting ? 'Añadiendo...' : 'Añadir Juego'}</button>
      </form>
    </div>
  );
}


function GamesPanel({ view, searchTerm }) {
  const [games, setGames] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  // La lógica de `view` y `searchTerm` ahora viene de las props

  const loadGames = async () => {
    setLoading(true);
    setError(null);
    const endpoint = view === 'favorites' ? '/api/games/favorites' : '/api/games';
    try {
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      setGames(result.data);
    } catch (error) {
      console.error('Error al cargar los juegos:', error);
      setError('No se pudieron cargar los juegos. ¿Está el servidor (server.js) corriendo?');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGames();
  }, [view]); // Se ejecuta cada vez que 'view' cambia

  const handleToggleFavorite = async (gameId, newFavoriteStatus) => {
    try {
      const response = await fetch(`/api/games/${gameId}/favorite`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ favorito: newFavoriteStatus ? 1 : 0 }),
      });

      if (response.ok) {
        if (view === 'favorites' && !newFavoriteStatus) {
          // Si estamos en favoritos y quitamos uno, lo filtramos de la vista actual
          setGames(games.filter(game => game.id !== gameId));
        } else {
          // En cualquier otro caso, actualizamos el item
          setGames(games.map(game => game.id === gameId ? { ...game, favorito: newFavoriteStatus } : game));
        }
      } else {
        console.error('Falló la actualización en el servidor');
      }
    } catch (error) {
      console.error('Error al actualizar favorito:', error);
    }
  };

  const handleGameAdded = () => {
    loadGames(); // Simplemente recargamos los juegos
  };

  const handleDeleteGame = async (gameId) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar este juego? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      const response = await fetch(`/api/games/${gameId}`, { method: 'DELETE' });
      if (response.ok) {
        setGames(games.filter(game => game.id !== gameId));
      } else {
        throw new Error('Error en el servidor al intentar eliminar el juego.');
      }
    } catch (error) {
      console.error('Error al eliminar el juego:', error);
      alert(error.message);
    }
  };

  const handleUpdateGame = async (gameId, newName) => {
    try {
      const response = await fetch(`/api/games/${gameId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: newName }),
      });

      if (response.ok) {
        setGames(games.map(game => game.id === gameId ? { ...game, nombre: newName } : game));
      } else {
        throw new Error('Error en el servidor al intentar actualizar el juego.');
      }
    } catch (error) {
      console.error('Error al actualizar el juego:', error);
      alert(error.message);
    }
  };

  // Filtramos los juegos basándonos en el término de búsqueda
  const filteredGames = games.filter(game =>
    game.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      {/* Formulario para añadir un nuevo juego */}
      <AddGameForm onGameAdded={handleGameAdded} />

      {/* Título de la sección */}
      <h2 className="mb-3">{view === 'favorites' ? 'Mis Juegos Favoritos' : 'Todos los Juegos'}</h2>

      {/* Grilla de juegos existentes */}
      <div className="game-grid">
        {error && <p>{error}</p>}
        {loading && <p>Cargando juegos...</p>}
        {!loading && !error && filteredGames.length > 0 && (
          filteredGames.map(game => (
            <GameCard key={game.id} game={game} onToggleFavorite={handleToggleFavorite} onDelete={handleDeleteGame} onUpdate={handleUpdateGame} />
          ))
        )}
        {!loading && !error && games.length > 0 && filteredGames.length === 0 && (
          <p>No se encontraron juegos que coincidan con tu búsqueda.</p>
        )}
        {!loading && !error && games.length === 0 && (
          <p>{view === 'favorites' ? 'No has añadido ningún juego a favoritos todavía.' : 'No hay juegos en la biblioteca. Añade uno nuevo.'}</p>
        )}
      </div>
    </>
  );
}

function FriendListItem({ friend, onDelete, onUpdate }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(friend.nombre);

  const handleUpdate = () => {
    if (editedName.trim() === '') {
      alert('El nombre no puede estar vacío.');
      return;
    }
    onUpdate(friend.id, editedName);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedName(friend.nombre);
    setIsEditing(false);
  };

  return (
    <div className="list-group-item d-flex justify-content-between align-items-center">
      {isEditing ? (
        <input
          type="text"
          className="form-control me-2"
          value={editedName}
          onChange={(e) => setEditedName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleUpdate()}
          autoFocus
        />
      ) : (
        <span>{friend.nombre}</span>
      )}
      <div className="d-flex gap-2">
        {isEditing ? (
          <>
            <button className="btn btn-success btn-sm" onClick={handleUpdate}><i className="bi bi-check-lg"></i></button>
            <button className="btn btn-secondary btn-sm" onClick={handleCancel}><i className="bi bi-x-lg"></i></button>
          </>
        ) : (
          <>
            <button className="btn btn-outline-secondary btn-sm" onClick={() => setIsEditing(true)}><i className="bi bi-pencil"></i></button>
            <button className="btn btn-outline-danger btn-sm" onClick={() => onDelete(friend.id)}><i className="bi bi-trash"></i></button>
          </>
        )}
      </div>
    </div>
  );
}

function FriendsPanel({ searchTerm }) {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadFriends = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/friends');
      if (!response.ok) {
        throw new Error('No se pudieron cargar los amigos.');
      }
      const result = await response.json();
      setFriends(result.data);
    } catch (error) {
      console.error("Error al cargar amigos:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFriends();
  }, []);

  const handleDeleteFriend = async (friendId) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar a este amigo?')) {
      return;
    }
    try {
      const response = await fetch(`/api/friends/${friendId}`, { method: 'DELETE' });
      if (response.ok) {
        setFriends(friends.filter(friend => friend.id !== friendId));
      } else {
        throw new Error('Error al eliminar al amigo.');
      }
    } catch (error) {
      alert(error.message);
    }
  };

  const handleUpdateFriend = async (friendId, newName) => {
    try {
      const response = await fetch(`/api/friends/${friendId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: newName }),
      });

      if (response.ok) {
        setFriends(friends.map(friend => friend.id === friendId ? { ...friend, nombre: newName } : friend));
      } else {
        throw new Error('Error en el servidor al intentar actualizar el amigo.');
      }
    } catch (error) {
      alert(error.message);
    }
  };

  const handleAddFriend = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const form = e.target;
    const formData = new FormData(form);
    try {
      const friendResponse = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: formData.get('nombre') }),
      });
      if (!friendResponse.ok) throw new Error('Error al guardar el amigo.');
      
      form.reset();
      loadFriends();
    } catch (error) {
      alert(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredFriends = friends.filter(friend =>
    friend.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      <div className="add-game-form mb-4 p-3 border rounded">
        <h4>Añadir Nuevo Amigo</h4>
        <form onSubmit={handleAddFriend}>
          <div className="input-group">
            <input type="text" name="nombre" className="form-control" placeholder="Nombre del amigo" required disabled={isSubmitting} />
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? '...' : 'Añadir'}
            </button>
          </div>
        </form>
      </div>
      <h2 className="mb-3">Mis Amigos</h2>
      <div className="list-group">
        {loading && <p>Cargando amigos...</p>}
        {error && <p className="text-danger">{error}</p>}
        {!loading && filteredFriends.length > 0 && filteredFriends.map(friend => (
          <FriendListItem key={friend.id} friend={friend} onDelete={handleDeleteFriend} onUpdate={handleUpdateFriend} />
        ))}
        {!loading && !error && friends.length === 0 && <div className="list-group-item">Aún no has añadido amigos.</div>}
      </div>
    </>
  );
}

function App() {
  const [view, setView] = useState('all'); // 'all', 'favorites', o 'friends'
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="layout">
      {/* Menú lateral */}
      <aside>
        <h3>🎮 Game Library</h3>
        <div className="input-group my-3">
          <span className="input-group-text">🔍</span>
          <input
            type="text"
            className="form-control"
            placeholder="Buscar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <nav>
          {/* Estos enlaces ahora controlan el estado 'view' de React */}
          <a href="#" onClick={(e) => { e.preventDefault(); setView('all'); }} className={`nav-link ${view === 'all' ? 'active' : ''}`}>
            🗂️ Todos los juegos
          </a>
          <a href="#" onClick={(e) => { e.preventDefault(); setView('favorites'); }} className={`nav-link ${view === 'favorites' ? 'active' : ''}`}>
            ❤️ Favoritos
          </a>
          <a href="#" onClick={(e) => { e.preventDefault(); setView('friends'); }} className={`nav-link ${view === 'friends' ? 'active' : ''}`}>
            👥 Amigos
          </a>
        </nav>
      </aside>

      {/* Contenido principal */}
      <main>
        {/* Renderizado condicional del panel */}
        {view === 'friends'
          ? <FriendsPanel searchTerm={searchTerm} />
          : <GamesPanel view={view} searchTerm={searchTerm} />
        }
      </main>
    </div>
  );
}

export default App
