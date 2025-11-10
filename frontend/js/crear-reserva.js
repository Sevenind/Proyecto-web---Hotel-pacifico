document.addEventListener('DOMContentLoaded', () => {
    
    // PROTEGER RUTA 
    const token = localStorage.getItem('userToken');
    if (!token) {
        window.location.href = 'login.html';
        return; // Detiene la ejecución
    }

    // Listener para el formulario de reserva
    const reservationForm = document.getElementById('new-reservation-form');
    if (reservationForm) {
        reservationForm.addEventListener('submit', manejarNuevaReserva); 
    }
});


// (CONECTAR API) Maneja la creación de una nueva reserva
async function manejarNuevaReserva(e) { 
    e.preventDefault();
    const token = localStorage.getItem('userToken');

    const data = {
        tipo_habitacion_id: parseInt(document.getElementById('room-type-select').value),
        fecha_checkin: document.getElementById('checkin').value,
        fecha_checkout: document.getElementById('checkout').value,
        total_personas: parseInt(document.getElementById('guests').value),
    };

    try {
        // CONECTAR API 
        // Endpoint: /reservas/ (POST)
        const response = await fetch(`${API_BASE_URL}/reservas/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            const nuevaReserva = await response.json();
            alert(`¡Reserva ${nuevaReserva.id} creada con éxito!`);
            
            window.location.href = 'profile.html';
            
        } else {
            const error = await response.json();
            alert(`Error al reservar: ${error.detail || 'No disponible'}`);
        }
        
    } catch (error) {
        console.error('Error creando reserva:', error);
    }
}