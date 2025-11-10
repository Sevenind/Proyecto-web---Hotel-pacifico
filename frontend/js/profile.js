document.addEventListener('DOMContentLoaded', () => {
    // Listeners para el Dropdown de Navegación 
    const profileTrigger = document.getElementById('nav-profile-trigger');
    const profileDropdown = document.getElementById('nav-profile-dropdown');
    
    if (profileTrigger) {
        profileTrigger.addEventListener('click', (e) => {
            e.preventDefault(); 
            profileDropdown.classList.toggle('hidden');
        });
    }
    
    document.addEventListener('click', (e) => {
        if (profileTrigger && profileDropdown && !profileTrigger.contains(e.target) && !profileDropdown.contains(e.target)) {
            profileDropdown.classList.add('hidden');
        }
    });

    //  Listeners para el Modal de Edición de Perfil 
    const openModalBtn = document.getElementById('open-edit-profile-modal');
    const closeModalBtn = document.getElementById('close-edit-profile-modal');
    const modalContainer = document.getElementById('edit-profile-modal');

    if (openModalBtn) {
        openModalBtn.addEventListener('click', (e) => {
            e.preventDefault();
            modalContainer.classList.remove('hidden');
            profileDropdown.classList.add('hidden'); 
        });
    }

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            modalContainer.classList.add('hidden');
        });
    }
    
    if (modalContainer) {
        modalContainer.addEventListener('click', (e) => {
            if (e.target === modalContainer) {
                modalContainer.classList.add('hidden');
            }
        });
    }
    
    const token = localStorage.getItem('userToken');
    if (!token) {
        window.location.href = 'login.html';
        return; 
    }

    // Cargar datos
    cargarDatosUsuario(); 
    cargarReservasUsuario(); 
    
    // Listeners de formularios de perfil
    const editForm = document.getElementById('edit-profile-form');
    editForm.addEventListener('submit', manejarEditarPerfil); 
    

    // Listeners para Acciones de Reserva (Modificar/Cancelar)
    const tableBody = document.querySelector('#reservations-list tbody');
    if (tableBody) {
        tableBody.addEventListener('click', manejarAccionesReserva); 
    }
    
    const editReservaForm = document.getElementById('edit-reserva-form');
    if (editReservaForm) {
        editReservaForm.addEventListener('submit', manejarEditarReserva); 
    }
  
}); 



// Carga los datos del usuario (guardados en localStorage) en el saludo y el formulario de edición.
function cargarDatosUsuario() { 
    const userString = localStorage.getItem('user');
    if (!userString) return;
    
    const user = JSON.parse(userString);

    document.getElementById('welcome-user').textContent = `Bienvenido, ${user.nombre} ${user.apellido}`;
    
    // Formulario de edición
    document.getElementById('edit-email').value = user.email;
    document.getElementById('edit-telefono').value = user.telefono || '';
}


// (CONECTAR API) Carga las reservas del usuario logueado
async function cargarReservasUsuario() { 
    const token = localStorage.getItem('userToken');
    const tableBody = document.querySelector('#reservations-list tbody');
    const noReservationsMsg = document.getElementById('no-reservations-msg');
    
    try {
        // Endpoint: /reservas/mis_reservas
        const response = await fetch(`${API_BASE_URL}/reservas/mis_reservas`, { 
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const reservas = await response.json();
            tableBody.innerHTML = '';

            if (reservas.length === 0) {
                noReservationsMsg.classList.remove('hidden');
            } else {
                noReservationsMsg.classList.add('hidden');
                reservas.forEach(reserva => {
                    
                    let actionButtonsHtml = ''; 

                    // Comprobar si la reserva NO está cancelada
                    if (reserva.estado_reserva !== 'Cancelada') {
                        
                        actionButtonsHtml = `
                        <td>
                            <button class="btn btn-small btn-modify" data-id="${reserva.id}">
                                <img src="img/edit-icon.png" alt="Modificar Reserva">
                            </button>
                            <button class="btn btn-small btn-danger" data-id="${reserva.id}">
                                <img src="img/cancel-icon.png" alt="Cancelar Reserva">
                            </button>
                        </td>
                        `;
                    } else {
                        // (Modificación de la respuesta anterior, para que la celda quede vacía)
                        actionButtonsHtml = '<td> </td>'; 
                    }
                    const row = `
                        <tr>
                            <td>Habitación #${reserva.habitacion.numero} (${reserva.habitacion.tipo.nombre_tipo})</td>
                            <td>${reserva.fecha_checkin}</td>
                            <td>${reserva.fecha_checkout}</td>
                            <td>${reserva.estado_reserva}</td>
                            ${actionButtonsHtml} 
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


// (CONECTAR API) Maneja la actualización de datos del cliente
async function manejarEditarPerfil(e) { 
    e.preventDefault();
    const token = localStorage.getItem('userToken');
    const user = JSON.parse(localStorage.getItem('user'));
    const dni_cliente = user.dni;

    const email = document.getElementById('edit-email').value;
    const telefono = document.getElementById('edit-telefono').value;
    const password = document.getElementById('edit-password').value;

    const dataToUpdate = {
        email: email,
        telefono: telefono ? parseInt(telefono) : null,
    };
    
    if (password) {
        dataToUpdate.password = password;
    }
    
    try {
        // CONECTAR API 
        // Endpoint: /clientes/{dni_cliente} (PUT) 
        const response = await fetch(`${API_BASE_URL}/clientes/${dni_cliente}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(dataToUpdate)
        });

        if (response.ok) {
            const updatedUser = await response.json();
            
            localStorage.setItem('user', JSON.stringify(updatedUser));
            
            alert('¡Datos actualizados con éxito!');
            cargarDatosUsuario(); 
            document.getElementById('edit-password').value = ''; // Limpiar campo de contraseña
            document.getElementById('edit-profile-modal').classList.add('hidden'); 
        } else {
            const error = await response.json();
            alert(`Error al actualizar: ${error.detail || 'Datos inválidos'}`);
        }
    } catch (error) {
        console.error('Error actualizando perfil:', error);
    }
}

// Delega los clics en la tabla de reservas
function manejarAccionesReserva(e) { 
    const token = localStorage.getItem('userToken');
    if (!token) return;

    // Clic en botón de cancelar
    const cancelBtn = e.target.closest('.btn-danger');
    if (cancelBtn) {
        const reservaId = cancelBtn.dataset.id;
        if (confirm(`¿Estás seguro de que quieres cancelar la reserva ${reservaId}?`)) {
            manejarCancelarReserva(reservaId, token); 
        }
    }

    // Clic en botón de modificar
    const modifyBtn = e.target.closest('.btn-modify');
    if (modifyBtn) {
        const reservaId = modifyBtn.dataset.id;
        
        const row = modifyBtn.closest('tr');
        const checkin = row.cells[1].textContent;
        const checkout = row.cells[2].textContent;

        mostrarModalEditarReserva(reservaId, checkin, checkout); 
    }
}

// Muestra y Rellena el modal para editar una reserva
function mostrarModalEditarReserva(reservaId, checkin, checkout) { 
    const modal = document.getElementById('edit-reserva-modal');
    
    document.getElementById('edit-reserva-id').value = reservaId;
    document.getElementById('edit-reserva-checkin').value = checkin;
    document.getElementById('edit-reserva-checkout').value = checkout;
    // (Asegúrate de que 'guests' se pida vacío, ya que no lo guardamos en la tabla)
    document.getElementById('edit-reserva-guests').value = ''; 

    modal.classList.remove('hidden');

    const closeModalBtn = document.getElementById('close-edit-reserva-modal');
    closeModalBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
    });
}


// (CONECTAR API) Llama a la API para CANCELAR una reserva
async function manejarCancelarReserva(reservaId, token) { 
    try {
        // CONECTAR API 
        // Endpoint: /reservas/{reservaId} (DELETE) 
        const response = await fetch(`${API_BASE_URL}/reservas/${reservaId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            alert('¡Reserva cancelada con éxito!');
            cargarReservasUsuario(); 
        } else {
            const error = await response.json();
            alert(`Error al cancelar: ${error.detail || 'No se pudo cancelar'}`);
        }
    } catch (error) {
        console.error('Error cancelando reserva:', error);
    }
}

// (CONECTAR API) Llama a la API para MODIFICAR una reserva 
async function manejarEditarReserva(e) { 
    e.preventDefault();
    const token = localStorage.getItem('userToken');

    const reservaId = document.getElementById('edit-reserva-id').value;
    const data = {
        fecha_checkin: document.getElementById('edit-reserva-checkin').value,
        fecha_checkout: document.getElementById('edit-reserva-checkout').value,
        total_personas: parseInt(document.getElementById('edit-reserva-guests').value),
    };

    try {
        // CONECTAR API 
        // Endpoint: /reservas/{reservaId} (PUT) 
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
            cargarReservasUsuario(); 
            document.getElementById('edit-reserva-modal').classList.add('hidden');
        } else {
            const error = await response.json();
            alert(`Error al modificar: ${error.detail || 'No disponible o datos incorrectos'}`);
        }
        
    } catch (error) {
        console.error('Error modificando reserva:', error);
    }
}