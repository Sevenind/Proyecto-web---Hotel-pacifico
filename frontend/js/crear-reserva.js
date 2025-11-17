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
    const roomTypeSelect = document.getElementById('room-type-select');
    const guestsInput = document.getElementById('guests');

    if (roomTypeSelect && guestsInput) {
        
        // 2. Creamos un 'listener' para el selector de habitación
        roomTypeSelect.addEventListener('change', (e) => {
            
            // 3. Obtenemos la opción seleccionada
            const selectedOption = e.target.options[e.target.selectedIndex];
            const capacity = selectedOption.getAttribute('data-capacity');

            if (capacity) {
                // 4. Si hay capacidad, la ponemos como 'max' y habilitamos el input
                guestsInput.max = capacity;
                guestsInput.value = 1; // Reseteamos a 1
                guestsInput.disabled = false;
                
            } else {
                // 5. Si eligen "Seleccione un tipo...", reseteamos y deshabilitamos
                guestsInput.value = '';
                guestsInput.disabled = true;
                guestsInput.removeAttribute('max');
            }
        });
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