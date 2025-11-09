document.addEventListener('DOMContentLoaded', () => {
    
    // PROTEGER RUTA 
    // Nadie debería estar en esta página sin un token
    const token = localStorage.getItem('userToken');
    if (!token) {
        window.location.href = 'login.html';
        return; // Detiene la ejecución
    }

    // Listener para el formulario de reserva
    const reservationForm = document.getElementById('new-reservation-form');
    if (reservationForm) {
        reservationForm.addEventListener('submit', handleNewReservation);
    }
});


// (CONECTAR API) Maneja la creación de una nueva reserva (Esta función fue movida desde profile.js)

async function handleNewReservation(e) {
    e.preventDefault();
    const token = localStorage.getItem('userToken');

    // Datos del formulario de reserva
    const data = {
        // El DNI del cliente se saca del Token en el backend
        // habitacion_id: (Necesitarías lógica para buscar habitaciones disponibles)
        tipo_habitacion_id: parseInt(document.getElementById('room-type-select').value),
        fecha_checkin: document.getElementById('checkin').value,
        fecha_checkout: document.getElementById('checkout').value,
        total_personas: parseInt(document.getElementById('guests').value),
    };

    try {
        // CONECTAR API 
        // Endpoint: /reservas/ 
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
            
            // Opcional: Redirigir al perfil para ver la reserva
            window.location.href = 'profile.html';
            
            // Limpiar formulario
            // e.target.reset(); // No es necesario si redirigimos
        } else {
            const error = await response.json();
            alert(`Error al reservar: ${error.detail || 'No disponible'}`);
        }
        
    } catch (error) {
        console.error('Error creando reserva:', error);
    }
}