document.addEventListener('DOMContentLoaded', () => {
    
    const adminLoginForm = document.getElementById('admin-login-form');
    
    if(adminLoginForm) {
        adminLoginForm.addEventListener('submit', manejarLoginAdmin); 
    }
});


async function manejarLoginAdmin(e) { 
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);

    try {
        // CONECTAR API
        // Endpoint: /admin/iniciar_sesion
        const response = await fetch(`${API_BASE_URL}/admin/iniciar_sesion`, { 
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData,
        });

        if (response.ok) {
            const data = await response.json();
            // Guardamos el token de admin
            localStorage.setItem('adminToken', data.access_token);
            // Borramos el de usuario por si estaba logueado como cliente
            localStorage.removeItem('userToken'); 
            localStorage.removeItem('user');
            window.location.href = 'admin.html';

        } else {
            alert('Error: Usuario o contraseña de admin incorrectos.');
        }
    } catch (error) {
        console.error('Error de red en admin login:', error);
        alert('Error de conexión. Inténtalo de nuevo.');
    }
}