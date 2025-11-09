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
    // (Este es el bloque correcto. El duplicado ha sido eliminado)
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
    
    // --- (ELIMINADO) ---
    // const reservationForm = document.getElementById('new-reservation-form');
    // reservationForm.addEventListener('submit', handleNewReservation);
    // --- (FIN ELIMINADO) ---

    // --- (NUEVO) Listeners para Acciones de Reserva (Modificar/Cancelar) ---
    // (Estos los habíamos añadido en pasos anteriores y también van aquí)
    const tableBody = document.querySelector('#reservations-list tbody');
    if (tableBody) {
        tableBody.addEventListener('click', handleReservationActions);
    }
    
    const editReservaForm = document.getElementById('edit-reserva-form');
    if (editReservaForm) {
        editReservaForm.addEventListener('submit', handleEditReservation);
    }
    
    // ==================================================================
    // ¡¡¡AQUÍ TERMINA EL 'DOMContentLoaded'!!!
    // ==================================================================
  
}); // <<--- ESTA ES LA LLAVE DE CIERRE CORRECTA



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
                   // --- MODIFICAR ESTA PLANTILLA OTRA VEZ (Versión con iconos dentro de botones) ---
                    const row = `
                        <tr>
                            <td>Habitación #${reserva.habitacion.numero} (${reserva.habitacion.tipo.nombre_tipo})</td>
                            <td>${reserva.fecha_checkin}</td>
                            <td>${reserva.fecha_checkout}</td>
                            <td>${reserva.estado_reserva}</td>
                            <td>
                                <button class="btn btn-small btn-modify" data-id="${reserva.id}">
                                    <img src="img/edit-icon.png" alt="Modificar Reserva">
                                </button>
                                <button class="btn btn-small btn-danger" data-id="${reserva.id}">
                                    <img src="img/cancel-icon.png" alt="Cancelar Reserva">
                                </button>
                            </td>
                        </tr>
                    `;
                    //
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


// --- (ELIMINADO) ---
// La función 'handleNewReservation' se ha movido
// a 'js/crear-reserva.js'
// --- (FIN ELIMINADO) ---


function handleReservationActions(e) {
    const token = localStorage.getItem('userToken');
    if (!token) return;

    // Detectar si se hizo clic en un botón de cancelar
    const cancelBtn = e.target.closest('.btn-danger');
    if (cancelBtn) {
        const reservaId = cancelBtn.dataset.id;
        if (confirm(`¿Estás seguro de que quieres cancelar la reserva ${reservaId}?`)) {
            handleCancelReservation(reservaId, token);
        }
    }

    // Detectar si se hizo clic en un botón de modificar
    const modifyBtn = e.target.closest('.btn-modify');
    if (modifyBtn) {
        const reservaId = modifyBtn.dataset.id;
        
        // Necesitamos los datos de la fila
        const row = modifyBtn.closest('tr');
        const checkin = row.cells[1].textContent;
        const checkout = row.cells[2].textContent;
        // Asumimos que el total de personas no se muestra, así que lo pediremos
        
        showEditReservationModal(reservaId, checkin, checkout);
    }
}

/**
 * (NUEVO) Muestra y Rellena el modal para editar una reserva
 */
function showEditReservationModal(reservaId, checkin, checkout) {
    const modal = document.getElementById('edit-reserva-modal');
    
    // Rellenamos el formulario del modal
    document.getElementById('edit-reserva-id').value = reservaId;
    document.getElementById('edit-reserva-checkin').value = checkin;
    document.getElementById('edit-reserva-checkout').value = checkout;
    document.getElementById('edit-reserva-guests').value = ''; // Pedir nuevo total

    // Mostramos el modal
    modal.classList.remove('hidden');

    // Listener para el botón de cerrar (el modal ya lo tiene en el HTML)
    const closeModalBtn = document.getElementById('close-edit-reserva-modal');
    closeModalBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
    });
}


/**
 * (NUEVO) Llama a la API para CANCELAR una reserva
 */
async function handleCancelReservation(reservaId, token) {
    try {
        // --- CONECTAR API ---
        // Endpoint: /reservas/{reserva_id} (DELETE)
        const response = await fetch(`${API_BASE_URL}/reservas/${reservaId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            alert('¡Reserva cancelada con éxito!');
            loadUserReservations(); // Recargamos la lista
        } else {
            const error = await response.json();
            alert(`Error al cancelar: ${error.detail || 'No se pudo cancelar'}`);
        }
    } catch (error) {
        console.error('Error cancelando reserva:', error);
    }
}

/**
 * (NUEVO) Llama a la API para MODIFICAR una reserva (submit del modal)
 */
async function handleEditReservation(e) {
    e.preventDefault();
    const token = localStorage.getItem('userToken');

    // Datos del formulario del MODAL
    const reservaId = document.getElementById('edit-reserva-id').value;
    const data = {
        fecha_checkin: document.getElementById('edit-reserva-checkin').value,
        fecha_checkout: document.getElementById('edit-reserva-checkout').value,
        total_personas: parseInt(document.getElementById('edit-reserva-guests').value),
    };

    try {
        // --- CONECTAR API ---
        // Endpoint: /reservas/{reserva_id} (PUT)
        const response = await fetch(`${API_BASE_URL}/reservas/${reservaId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            alert('¡Reserva modificada con éxito!');
            loadUserReservations(); // Recargamos la lista
            // Ocultamos el modal
            document.getElementById('edit-reserva-modal').classList.add('hidden');
        } else {
            const error = await response.json();
            alert(`Error al modificar: ${error.detail || 'No disponible o datos incorrectos'}`);
        }
        
    } catch (error) {
        console.error('Error modificando reserva:', error);
    }
}