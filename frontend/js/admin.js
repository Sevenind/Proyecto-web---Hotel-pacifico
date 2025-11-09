// NOTA DE SEGURIDAD:
// En un proyecto real, la página de Admin debería estar protegida
// por un 'rol' de administrador, no solo por estar logueado.
// Tu API de FastAPI debería verificar ese rol.

document.addEventListener('DOMContentLoaded', () => {
    
    // --- (CAMBIO 1) ---
    // Protección simple: Busca el 'adminToken' que creamos
    const token = localStorage.getItem('adminToken');
    if (!token) {
        // (CAMBIO 2) Si no lo tiene, lo manda al login de admin
        window.location.href = 'admin-login.html';
        return;
    }
    // --- (FIN DE CAMBIOS) ---

    // Listeners para los formularios de búsqueda (esto queda igual)
    document.getElementById('search-dni-form').addEventListener('submit', searchByDni);
    document.getElementById('search-date-form').addEventListener('submit', searchByDate);
});

async function searchByDni(e) {
    e.preventDefault();
    const dni = document.getElementById('search-dni').value;
    
    // --- CONECTAR API ---
    // Endpoint: /admin/reservas/cliente/{dni}
    const url = `${API_BASE_URL}/admin/reservas/cliente/${dni}`;
    
    await fetchAndDisplayReservations(url);
}

async function searchByDate(e) {
    e.preventDefault();
    const checkin = document.getElementById('search-checkin').value;
    const checkout = document.getElementById('search-checkout').value;
    
    // --- CONECTAR API ---
    // Endpoint: /admin/reservas/fechas?fecha_inicio=...&fecha_fin=...
    const url = `${API_BASE_URL}/admin/reservas/fechas?fecha_inicio=${checkin}&fecha_fin=${checkout}`;

    await fetchAndDisplayReservations(url);
}

/**
 * Función genérica para llamar a la API de admin y mostrar resultados
 */
async function fetchAndDisplayReservations(url) {
    
    // --- (CAMBIO 3) ---
    // Usa el 'adminToken' para hacer la llamada a la API
    const token = localStorage.getItem('adminToken');
    // --- (FIN DE CAMBIO) ---
    
    const tableBody = document.querySelector('#admin-reservations-list tbody');
    const noResultsMsg = document.getElementById('admin-no-results');

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const reservas = await response.json();
            tableBody.innerHTML = ''; // Limpiar tabla

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
             // El error 401 (No autorizado) de la API de admin
             // ahora se mostrará aquí
             alert('Error buscando reservas o no tienes permisos.');
        }

    } catch (error) {
        console.error('Error en búsqueda admin:', error);
    }
}