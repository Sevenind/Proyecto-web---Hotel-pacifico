document.addEventListener('DOMContentLoaded', () => {
    
    const token = localStorage.getItem('adminToken');
    if (!token) {
        // Importante si no hay token de admin, lo enviamos al login de admin
        window.location.href = 'admin-login.html'; 
        return;
    }

    document.getElementById('search-dni-form').addEventListener('submit', buscarPorDni); 
    document.getElementById('search-date-form').addEventListener('submit', buscarPorFecha); 
});

// Busca reservas por el DNI del cliente
async function buscarPorDni(e) { 
    e.preventDefault();
    const dni = document.getElementById('search-dni').value;
    
    // CONECTAR API 
    const url = `${API_BASE_URL}/admin/reservas/cliente/${dni}`;
    
    await obtenerYMostrarReservas(url); 
}

// Busca reservas por rango de fechas
async function buscarPorFecha(e) { 
    e.preventDefault();
    const checkin = document.getElementById('search-checkin').value;
    const checkout = document.getElementById('search-checkout').value;
    
    // CONECTAR API 
    const url = `${API_BASE_URL}/admin/reservas/fechas?fecha_inicio=${checkin}&fecha_fin=${checkout}`;

    await obtenerYMostrarReservas(url); 
}

// Función genérica para llamar a la API de admin y mostrar resultados
async function obtenerYMostrarReservas(url) { 
    
    const token = localStorage.getItem('adminToken');
    const tableBody = document.querySelector('#admin-reservations-list tbody');
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
                // (Usamos los schemas de Admin que devuelven info del cliente)
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
             // Si la API falla (ej. 401 Unauthorized), mostramos error
             noResultsMsg.classList.remove('hidden');
             tableBody.innerHTML = '';
             
             // Si el token expiró o es inválido, cerramos sesión
             if (response.status === 401) {
                alert('Tu sesión de administrador ha expirado. Por favor, inicia sesión de nuevo.');
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