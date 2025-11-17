let todosLosClientes = [];
let todasLasHabitaciones = []; // <-- Variable global para guardar las habitaciones

document.addEventListener('DOMContentLoaded', () => {
    
    const token = localStorage.getItem('adminToken');
    if (!token) {
        window.location.href = 'admin-login.html'; 
        return;
    }

    // --- Listeners del Menú Principal ---
    document.getElementById('btn-vista-clientes').addEventListener('click', mostrarVistaClientes);
    document.getElementById('btn-vista-reservas').addEventListener('click', mostrarVistaReservas);
    document.getElementById('btn-vista-habitaciones').addEventListener('click', mostrarVistaHabitaciones);

    // --- Listeners de Botones "Volver" ---
    document.querySelectorAll('.btn-back').forEach(btn => {
        btn.addEventListener('click', mostrarMenuPrincipal);
    });

    // --- Listeners Vista Clientes ---
    const clientForm = document.getElementById('search-client-form');
    clientForm.addEventListener('submit', (e) => {
        e.preventDefault(); 
        manejarBusquedaCliente(); 
    });
    
    document.getElementById('search-client-value').addEventListener('input', manejarBusquedaCliente);
    document.getElementById('search-client-type').addEventListener('change', manejarBusquedaCliente);
    
    document.querySelector('#client-list tbody').addEventListener('click', (e) => {
        const viewButton = e.target.closest('.btn-view-client');
        if (viewButton) {
            const dni = viewButton.dataset.dni;
            abrirModalCliente(dni);
        }
    });

    // --- Listeners Vista Reservas ---
    document.getElementById('search-date-form').addEventListener('submit', buscarPorFecha); 

    // --- Listeners del Modal de Cliente ---
    const clientModal = document.getElementById('client-detail-modal');
    document.getElementById('close-client-modal').addEventListener('click', () => {
        clientModal.classList.add('hidden');
    });
    clientModal.addEventListener('click', (e) => {
        if (e.target === clientModal) {
            clientModal.classList.add('hidden');
        }
    });

    // --- INICIO: NUEVOS LISTENERS PARA PANELES Y MODAL DE HABITACIONES ---
    
    // 1. Listener para los 4 botones (paneles)
    const habMenu = document.getElementById('habitaciones-menu-paneles');
    if (habMenu) {
        habMenu.addEventListener('click', manejarClickPanelHabitacion);
    }
    
    // 2. Listeners para el nuevo modal (pop-up)
    const habModal = document.getElementById('habitaciones-tipo-modal');
    const closeHabModalBtn = document.getElementById('close-habitaciones-modal');
    
    if (habModal) {
        // Cierra el modal si se hace clic fuera
        habModal.addEventListener('click', (e) => {
            if (e.target === habModal) {
                habModal.classList.add('hidden');
            }
        });
        
        // 3. ¡IMPORTANTE! Movemos el listener de los <select> al modal
        habModal.addEventListener('change', manejarCambioEstadoHabitacion);
    }
    if (closeHabModalBtn) {
        // Cierra el modal con el botón X
        closeHabModalBtn.addEventListener('click', () => {
            habModal.classList.add('hidden');
        });
    }
    // --- FIN: NUEVOS LISTENERS ---
});

// ==================================================
// FUNCIONES DE NAVEGACIÓN (VISTAS)
// ==================================================

// Oculta todas las vistas y muestra la solicitada
function mostrarVista(idVista) {
    document.getElementById('admin-dashboard-main').classList.add('hidden');
    document.getElementById('admin-client-view').classList.add('hidden');
    document.getElementById('admin-reservation-view').classList.add('hidden');
    document.getElementById('admin-habitaciones-view').classList.add('hidden');
    
    document.getElementById(idVista).classList.remove('hidden');
}

function mostrarMenuPrincipal(e) {
    if(e) e.preventDefault();
    mostrarVista('admin-dashboard-main');
}

function mostrarVistaClientes(e) {
    e.preventDefault();
    mostrarVista('admin-client-view');
    if (todosLosClientes.length === 0) {
        cargarTodosLosClientes();
    } else {
        mostrarListaClientes(todosLosClientes);
    }
}

function mostrarVistaReservas(e) {
    e.preventDefault();
    mostrarVista('admin-reservation-view');
}


// ==================================================
// FUNCIONES DE LA VISTA "CLIENTES"
// (Estas funciones quedan igual)
// ==================================================

async function cargarTodosLosClientes() {
    const token = localStorage.getItem('adminToken');
    const url = `${API_BASE_URL}/admin/clientes`;
    const tableBody = document.querySelector('#client-list tbody');
    const noResultsMsg = document.getElementById('client-list-no-results');

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            if (response.status === 401) {
                alert('Sesión expirada. Por favor, inicia sesión de nuevo.');
                window.location.href = 'admin-login.html';
            }
            throw new Error('Error de red o del servidor'); 
        }
        
        todosLosClientes = await response.json();
        mostrarListaClientes(todosLosClientes);

    } catch (error) {
        console.error('Error cargando clientes:', error);
        tableBody.innerHTML = ''; 
        noResultsMsg.textContent = 'Error al cargar los clientes. Intenta recargar.';
        noResultsMsg.classList.remove('hidden');
    }
}

function mostrarListaClientes(clientes) {
    const tableBody = document.querySelector('#client-list tbody');
    const noResultsMsg = document.getElementById('client-list-no-results');
    tableBody.innerHTML = '';

    if (clientes.length === 0) {
        noResultsMsg.textContent = 'No se encontraron clientes.';
        noResultsMsg.classList.remove('hidden');
    } else {
        noResultsMsg.classList.add('hidden');
        clientes.forEach(cliente => {
            const row = `
                <tr>
                    <td>${cliente.dni}</td>
                    <td>${cliente.nombre} ${cliente.apellido}</td>
                    <td>${cliente.email}</td>
                    <td>${cliente.telefono}</td>
                    <td>
                        <button class="btn btn-small btn-modify btn-view-client" data-dni="${cliente.dni}">
                            <img src="img/view-details-icon.png" alt="Ver Detalles">
                        </button>
                    </td>
                </tr>
            `;
            tableBody.innerHTML += row;
        });
    }
}

function manejarBusquedaCliente() {
    const tipo = document.getElementById('search-client-type').value;
    const valor = document.getElementById('search-client-value').value.toLowerCase().trim();

    if (valor === '') {
        mostrarListaClientes(todosLosClientes); 
        return;
    }

    const clientesFiltrados = todosLosClientes.filter(cliente => {
        if (!cliente) return false; 

        if (tipo === 'dni') {
            return cliente.dni && cliente.dni.toString().includes(valor);
        }
        if (tipo === 'nombre_apellido') {
            const nombreCompleto = `${cliente.nombre} ${cliente.apellido}`.toLowerCase();
            return nombreCompleto.includes(valor);
        }
        if (tipo === 'email') {
            return cliente.email && cliente.email.toLowerCase().includes(valor);
        }
        return false;
    });

    mostrarListaClientes(clientesFiltrados);
}

async function abrirModalCliente(dni) {
    const token = localStorage.getItem('adminToken');
    const url = `${API_BASE_URL}/admin/clientes/${dni}`;
    
    const modal = document.getElementById('client-detail-modal');
    const detailsDiv = document.getElementById('client-detail-modal-details');
    const reservationsTbody = document.querySelector('#client-detail-modal-reservations tbody');
    const noReservationsMsg = document.getElementById('modal-no-reservations');

    detailsDiv.innerHTML = 'Cargando...';
    reservationsTbody.innerHTML = '';
    noReservationsMsg.classList.add('hidden');
    
    modal.classList.remove('hidden');

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error('Cliente no encontrado');
        }

        const data = await response.json(); 
        const cliente = data.cliente;
        const reservas = data.reservas;

        detailsDiv.innerHTML = `
            <p><strong>Nombre:</strong> ${cliente.nombre} ${cliente.apellido}</p>
            <p><strong>DNI:</strong> ${cliente.dni}</p>
            <p><strong>Email:</strong> ${cliente.email}</p>
            <p><strong>Teléfono:</strong> ${cliente.telefono}</p>
        `;

        if (reservas.length === 0) {
            noReservationsMsg.classList.remove('hidden');
        } else {
            noReservationsMsg.classList.add('hidden');
            reservas.forEach(reserva => {
                const row = `
                    <tr>
                        <td>${reserva.id}</td>
                        <td>Hab. #${reserva.habitacion.numero} (${reserva.habitacion.tipo.nombre_tipo})</td>
                        <td>${reserva.fecha_checkin}</td>
                        <td>${reserva.fecha_checkout}</td>
                    </tr>
                `;
                reservationsTbody.innerHTML += row;
            });
        }

    } catch (error) {
        console.error('Error abriendo modal:', error);
        detailsDiv.innerHTML = '<p class="form-error-text">Error al cargar los datos del cliente.</p>';
    }
}


// ==================================================
// FUNCIONES DE LA VISTA "RESERVAS"
// (Estas funciones quedan igual)
// ==================================================

async function buscarPorFecha(e) { 
    e.preventDefault();
    const checkin = document.getElementById('search-checkin').value;
    const checkout = document.getElementById('search-checkout').value;
    
    const url = `${API_BASE_URL}/admin/reservas/fechas?fecha_inicio=${checkin}&fecha_fin=${checkout}`;

    await obtenerYMostrarReservas(url); 
}

async function obtenerYMostrarReservas(url) { 
    
    const token = localStorage.getItem('adminToken');
    const tableBody = document.querySelector('#reservation-results-table tbody');
    const noResultsMsg = document.getElementById('admin-no-results');

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const reservas = await response.json();
            tableBody.innerHTML = ''; 

            if (reservas.length === 0) {
                noResultsMsg.classList.remove('hidden');
            } else {
                noResultsMsg.classList.add('hidden');
                reservas.forEach(reserva => {
                    const row = `
                        <tr>
                            <td>${reserva.id}</td>
                            <td>${reserva.cliente.nombre} (${reserva.cliente.dni})</td>
                            <td>Hab. #${reserva.habitacion.numero}</td>
                            <td>${reserva.fecha_checkin}</td>
                            <td>${reserva.fecha_checkout}</td>
                            <td>${reserva.estado_reserva}</td>
                        </tr>
                    `;
                    tableBody.innerHTML += row;
                });
            }
        } else {
             noResultsMsg.classList.remove('hidden');
             tableBody.innerHTML = '';
             
             if (response.status === 401) {
                alert('Tu sesión de administrador ha expirado.');
                localStorage.removeItem('adminToken');
                window.location.href = 'admin-login.html';
             } else {
                alert('Error buscando reservas.');
             }
        }

    } catch (error) {
        console.error('Error en búsqueda admin:', error);
    }
}


// ==================================================
// INICIO: FUNCIONES DE LA VISTA "HABITACIONES" (MODIFICADAS)
// ==================================================

// 1. Muestra la vista y carga los datos (solo si no están cargados)
function mostrarVistaHabitaciones(e) {
    e.preventDefault();
    mostrarVista('admin-habitaciones-view');
    // Carga las habitaciones UNA SOLA VEZ y las guarda
    if (todasLasHabitaciones.length === 0) {
        cargarYAlmacenarHabitaciones(); 
    }
}

// 2. Solo hace el fetch y guarda en la variable global
async function cargarYAlmacenarHabitaciones() {
    const token = localStorage.getItem('adminToken');
    const url = `${API_BASE_URL}/admin/habitaciones`;
    
    // Muestra "Cargando..." en los paneles
    document.querySelectorAll('.btn-abrir-modal-hab h2').forEach(titulo => {
        titulo.textContent = 'Cargando...';
    });

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            if (response.status === 401) window.location.href = 'admin-login.html';
            throw new Error('Error al cargar habitaciones');
        }
        
        todasLasHabitaciones = await response.json();
        
        // Restaura los títulos de los paneles
        restaurarTitulosPaneles();

    } catch (error) {
        console.error('Error cargando habitaciones:', error);
        document.querySelectorAll('.btn-abrir-modal-hab h2').forEach(titulo => {
            titulo.textContent = 'Error al Cargar';
        });
    }
}

// 3. Devuelve los títulos a los botones
function restaurarTitulosPaneles() {
    document.querySelector('.btn-abrir-modal-hab[data-tipo-id="1"] h2').textContent = "Normal (King Size)";
    document.querySelector('.btn-abrir-modal-hab[data-tipo-id="2"] h2').textContent = "Individual";
    document.querySelector('.btn-abrir-modal-hab[data-tipo-id="3"] h2').textContent = "Grande (Familiar)";
    document.querySelector('.btn-abrir-modal-hab[data-tipo-id="4"] h2').textContent = "Suite";
}

// 4. Se activa al hacer clic en un panel
function manejarClickPanelHabitacion(e) {
    e.preventDefault();
    const panel = e.target.closest('.btn-abrir-modal-hab');
    if (!panel) return; 

    if (todasLasHabitaciones.length === 0) {
        alert('Por favor, espera a que las habitaciones terminen de cargar.');
        return;
    }

    const tipoId = parseInt(panel.dataset.tipoId);
    const tipoNombre = panel.dataset.tipoNombre;

    // Llama a la función que arma y abre el modal
    popularYAbrirModalHabitaciones(tipoId, tipoNombre);
}

// 5. Llama a la API para ACTUALIZAR el estado (igual que antes)
async function manejarCambioEstadoHabitacion(e) {
    // Verificar que el evento vino de nuestro select
    if (!e.target.classList.contains('estado-habitacion-select')) {
        return;
    }

    const select = e.target;
    const habitacionId = select.dataset.id;
    const nuevoEstado = select.value;
    
    select.disabled = true;
    
    const token = localStorage.getItem('adminToken');
    const url = `${API_BASE_URL}/admin/habitaciones/${habitacionId}/estado`;

    try {
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ estado: nuevoEstado }) 
        });

        if (!response.ok) {
            throw new Error('No se pudo actualizar el estado.');
        }

        const habitacionActualizada = await response.json();
        console.log('Estado actualizado:', habitacionActualizada);
        
        // Actualizar la lista global
        const index = todasLasHabitaciones.findIndex(h => h.id === habitacionActualizada.id);
        if (index !== -1) {
            todasLasHabitaciones[index] = habitacionActualizada;
        }
        
        select.disabled = false;
        
    } catch (error) {
        console.error('Error actualizando estado:', error);
        alert('Error al guardar. El estado anterior será restaurado.');
        
        // Limpiamos la caché de habitaciones
        todasLasHabitaciones = []; 
        // Volvemos a cargar los datos (esto restaurará los títulos)
        cargarYAlmacenarHabitaciones();
        
        // Cerramos el modal
        document.getElementById('habitaciones-tipo-modal').classList.add('hidden');
    }
}

// 6. NUEVA FUNCIÓN: Arma el HTML del modal y lo muestra
function popularYAbrirModalHabitaciones(tipoId, tipoNombre) {
    const modal = document.getElementById('habitaciones-tipo-modal');
    const titulo = document.getElementById('modal-habitaciones-titulo');
    const lista = document.getElementById('modal-habitaciones-lista');

    titulo.textContent = tipoNombre; // Pone el título (Ej: "Suite")
    lista.innerHTML = ''; // Limpia la lista anterior

    // Filtra las habitaciones que coinciden con el tipo
    const habitacionesFiltradas = todasLasHabitaciones.filter(hab => hab.tipo.id === tipoId);

    if (habitacionesFiltradas.length === 0) {
        lista.innerHTML = '<p>No hay habitaciones de este tipo.</p>';
    } else {
        // Genera el HTML para cada habitación de ESE tipo
        habitacionesFiltradas.forEach(hab => {
            const habHtml = `
                <div class="habitacion-item">
                    <span>Habitación #${hab.numero}</span>
                    <select class="estado-habitacion-select" data-id="${hab.id}">
                        <option value="Activa" ${hab.estado === 'Activa' ? 'selected' : ''}>
                            Activa
                        </option>
                        <option value="Mantenimiento" ${hab.estado === 'Mantenimiento' ? 'selected' : ''}>
                            Mantenimiento
                        </option>
                    </select>
                </div>
            `;
            lista.innerHTML += habHtml;
        });
    }
    
    modal.classList.remove('hidden'); // Muestra el modal
}
// ==================================================
// FIN: FUNCIONES DE LA VISTA "HABITACIONES"
// ==================================================