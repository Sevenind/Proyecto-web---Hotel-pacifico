document.addEventListener('DOMContentLoaded', () => {
    
    const adminLoginForm = document.getElementById('admin-login-form');
    
    if(adminLoginForm) {
        adminLoginForm.addEventListener('submit', handleAdminLogin);
    }
});

/**
 * (NUEVO) Maneja el envío del formulario de LOGIN de ADMIN
 */
async function handleAdminLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    // Para FastAPI/OAuth2, se envían datos de formulario
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);

    try {
        // --- CONECTAR API (Nuevo Endpoint) ---
        const response = await fetch(`${API_BASE_URL}/admin/login/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData,
        });

        if (response.ok) {
            const data = await response.json();
            
            // --- (IMPORTANTE) Guardamos un token de ADMIN ---
            localStorage.setItem('adminToken', data.access_token);
            // (Opcional) Limpiamos cualquier token de usuario normal
            localStorage.removeItem('userToken');

            alert('¡Inicio de sesión de admin exitoso!');
            window.location.href = 'admin.html'; // Redirige al panel de admin

        } else {
            alert('Error: Usuario o contraseña de admin incorrectos.');
        }
    } catch (error) {
        console.error('Error de red en admin login:', error);
        alert('Error de conexión. Inténtalo de nuevo.');
    }
}