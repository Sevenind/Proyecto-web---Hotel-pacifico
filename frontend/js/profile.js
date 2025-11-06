document.addEventListener('DOMContentLoaded', () => {
    // --- (NUEVO) Listeners para el Dropdown de Navegación ---
    const profileTrigger = document.getElementById('nav-profile-trigger');
    const profileDropdown = document.getElementById('nav-profile-dropdown');
    
    if (profileTrigger) {
        profileTrigger.addEventListener('click', (e) => {
            e.preventDefault(); // Previene que el link '#' navegue
            profileDropdown.classList.toggle('hidden');
        });
    }
    
    // Cierra el dropdown si se hace clic fuera de él
    document.addEventListener('click', (e) => {
        // Asegúrate de que los elementos existen antes de leer 'contains'
        if (profileTrigger && profileDropdown && !profileTrigger.contains(e.target) && !profileDropdown.contains(e.target)) {
            profileDropdown.classList.add('hidden');
        }
    });


    // --- (NUEVO) Listeners para el Modal de Edición de Perfil ---
    const openModalBtn = document.getElementById('open-edit-profile-modal');
    const closeModalBtn = document.getElementById('close-edit-profile-modal');
    const modalContainer = document.getElementById('edit-profile-modal');

    if (openModalBtn) {
        openModalBtn.addEventListener('click', (e) => {
            e.preventDefault();
            modalContainer.classList.remove('hidden');
            profileDropdown.classList.add('hidden'); // Oculta el dropdown
        });
    }

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            modalContainer.classList.add('hidden');
        });
    }
    
    // Cierra el modal si se hace clic en el fondo oscuro
    if (modalContainer) {
        modalContainer.addEventListener('click', (e) => {
            // Si se hizo clic en el contenedor (fondo) y no en el contenido
            if (e.target === modalContainer) {
                modalContainer.classList.add('hidden');
            }
        });
    }
    
    // --- 1. PROTEGER RUTA ---
    // Si no hay token, no debería estar aquí. Lo echamos a 'login.html'.
    const token = localStorage.getItem('userToken');
    if (!token) {
        window.location.href = 'login.html';
        return; // Detiene la ejecución
    }

    // --- 2. Cargar datos ---
    loadUserData();
    loadUserReservations();
    
    // --- 3. Listeners de formularios de perfil ---
    const editForm = document.getElementById('edit-profile-form');
    editForm.addEventListener('submit', handleEditProfile);
    
    const reservationForm = document.getElementById('new-reservation-form');
    reservationForm.addEventListener('submit', handleNewReservation);
});


/**
 * Carga los datos del usuario (guardados en localStorage)
 * en el saludo y el formulario de edición.
 */
function loadUserData() {
    const userString = localStorage.getItem('user');
    if (!userString) return;
    
    const user = JSON.parse(userString);

    // Saludo
    document.getElementById('welcome-user').textContent = `Bienvenido, ${user.nombre} ${user.apellido}`;
    
    // Formulario de edición
    document.getElementById('edit-email').value = user.email;
    document.getElementById('edit-telefono').value = user.telefono || '';
}


/**
 * (CONECTAR API) Carga las reservas del usuario logueado
 */
async function loadUserReservations() {
    const token = localStorage.getItem('userToken');
    const tableBody = document.querySelector('#reservations-list tbody');
    const noReservationsMsg = document.getElementById('no-reservations-msg');
    
    try {
        // --- CONECTAR API ---
        // Endpoint: /reservas/me (protegido)
        const response = await fetch(`${API_BASE_URL}/reservas/me`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const reservas = await response.json();
            tableBody.innerHTML = ''; // Limpiar tabla

            if (reservas.length === 0) {
                noReservationsMsg.classList.remove('hidden');
            } else {
                noReservationsMsg.classList.add('hidden');
                reservas.forEach(reserva => {
                    const row = `
                        <tr>
                            <td>Habitación #${reserva.habitacion.numero} (${reserva.habitacion.tipo.nombre_tipo})</td>
                            <td>${reserva.fecha_checkin}</td>
                            <td>${reserva.fecha_checkout}</td>
                            <td>${reserva.estado_reserva}</td>
                        </tr>
                    `;
                    tableBody.innerHTML += row;
                });
            }
        } else {
            alert('No se pudieron cargar tus reservas.');
        }
    } catch (error) {
        console.error('Error cargando reservas:', error);
    }
}


/**
 * (CONECTAR API) Maneja la actualización de datos del cliente
 * (Corresponde a tu 'modificar_cliente_datos')
 */
async function handleEditProfile(e) {
    e.preventDefault();
    const token = localStorage.getItem('userToken');
    
    // DNI (PK) no se modifica, lo tomamos del usuario guardado
    const user = JSON.parse(localStorage.getItem('user'));
    const dni_cliente = user.dni;

    // Datos a actualizar
    const email = document.getElementById('edit-email').value;
    const telefono = document.getElementById('edit-telefono').value;
    const password = document.getElementById('edit-password').value;

    const dataToUpdate = {
        email: email,
        telefono: telefono ? parseInt(telefono) : null,
    };
    
    // Solo incluimos la contraseña si el usuario escribió una nueva
    if (password) {
        dataToUpdate.password = password;
    }
    
    try {
        // --- CONECTAR API ---
        // Endpoint: /clientes/{dni_cliente} (PUT o PATCH)
        const response = await fetch(`${API_BASE_URL}/clientes/${dni_cliente}`, {
            method: 'PUT', // o 'PATCH'
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(dataToUpdate)
        });

        if (response.ok) {
            const updatedUser = await response.json();
            
            // Actualizamos el usuario en localStorage
            localStorage.setItem('user', JSON.stringify(updatedUser));
            
            alert('¡Datos actualizados con éxito!');
            loadUserData(); // Recargamos los datos en el formulario
            document.getElementById('edit-password').value = ''; // Limpiamos el campo de pass
        } else {
            const error = await response.json();
            alert(`Error al actualizar: ${error.detail || 'Datos inválidos'}`);
        }
    } catch (error) {
        console.error('Error actualizando perfil:', error);
    }
}


/**
 * (CONECTAR API) Maneja la creación de una nueva reserva
 */
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

    // --- (Esto es una simplificación) ---
    // En un sistema real, primero buscarías habitaciones disponibles
    // y luego reservarías una 'habitacion_id' específica.
    
    try {
        // --- CONECTAR API ---
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
            loadUserReservations(); // Recargamos la lista de reservas
            // Limpiar formulario
            e.target.reset();
        } else {
            const error = await response.json();
            alert(`Error al reservar: ${error.detail || 'No disponible'}`);
        }
        
    } catch (error) {
        console.error('Error creando reserva:', error);
    }
}