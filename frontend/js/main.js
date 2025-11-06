// Variable 'global' para la URL de tu API
// Cámbiala cuando subas tu API a producción
const API_BASE_URL = 'http://127.0.0.1:8000/api/v1'; // Asumiendo que tu FastAPI corre en el puerto 8000

// --- 1. LÓGICA DE ESTADO DE AUTENTICACIÓN ---

document.addEventListener('DOMContentLoaded', () => {
    
    checkLoginState();

    // Listeners para los formularios de login y registro
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }
    
    // Listener para el botón de logout (que está en varias páginas)
    const logoutBtn = document.getElementById('nav-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
});

/**
 * Revisa si el usuario está logueado (mirando localStorage)
 * y actualiza la barra de navegación (NAV)
 */
function checkLoginState() {
    const userToken = localStorage.getItem('userToken');
    
    // IDs de los botones del NAV
    const navLogin = document.getElementById('nav-login');
    const navRegister = document.getElementById('nav-register');
    const navProfile = document.getElementById('nav-profile');
    const navLogout = document.getElementById('nav-logout');
    const heroBookBtn = document.getElementById('hero-book-btn');

    if (userToken) {
        // --- Usuario LOGUEADO ---
        if (navLogin) navLogin.classList.add('hidden');
        if (navRegister) navRegister.classList.add('hidden');
        if (navProfile) navProfile.classList.remove('hidden');
        if (navLogout) navLogout.classList.remove('hidden');
        
        // El botón de "Reservar" ahora lleva al perfil
        if (heroBookBtn) {
            heroBookBtn.href = "profile.html#new-reservation";
        }
        
    } else {
        // --- Usuario NO LOGUEADO ---
        if (navLogin) navLogin.classList.remove('hidden');
        if (navRegister) navRegister.classList.remove('hidden');
        if (navProfile) navProfile.classList.add('hidden');
        if (navLogout) navLogout.classList.add('hidden');

        // El botón de "Reservar" lleva al registro
        if (heroBookBtn) {
            heroBookBtn.href = "register.html";
        }
    }
}


// --- 2. MANEJADORES DE FORMULARIOS (LOGIN / REGISTRO) ---

/**
 * Maneja el envío del formulario de REGISTRO
 */
async function handleRegister(e) {
    e.preventDefault(); // Evita que la página se recargue

    // Obtener datos del formulario de registro
    const dni = document.getElementById('dni').value;
    const nombre = document.getElementById('nombre').value;
    const apellido = document.getElementById('apellido').value;
    const email = document.getElementById('email').value;
    const telefono = document.getElementById('telefono').value;
    const password = document.getElementById('password').value;

    // Crear el cuerpo de la petición (debe coincidir con tu API)
    const userData = {
        dni: parseInt(dni),
        nombre: nombre,
        apellido: apellido,
        email: email,
        telefono: parseInt(telefono),
        password: password
    };

    try {
        // --- CONECTAR API ---
        // Aquí llamas a tu endpoint de FastAPI para registrar
        // (Ej: /clientes/register)
        const response = await fetch(`${API_BASE_URL}/clientes/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(userData),
        });

        if (response.ok) {
            // response.json() te daría el nuevo cliente
            const nuevoCliente = await response.json(); 
            console.log('Registro exitoso:', nuevoCliente);
            alert('¡Registro exitoso! Por favor, inicia sesión.');
            window.location.href = 'login.html'; // Redirige a login
        } else {
            // Manejar errores (ej: DNI o email duplicado)
            const error = await response.json();
            console.error('Error en registro:', error);
            alert(`Error: ${error.detail || 'No se pudo completar el registro.'}`);
        }

    } catch (error) {
        console.error('Error de red:', error);
        alert('Error de conexión. Inténtalo de nuevo.');
    }
}


/**
 * Maneja el envío del formulario de LOGIN
 */
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    // Para FastAPI/OAuth2, se envían datos de formulario
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);

    try {
        // --- CONECTAR API ---
        // Aquí llamas a tu endpoint de FastAPI para login
        // (Ej: /token o /clientes/login)
        const response = await fetch(`${API_BASE_URL}/clientes/login/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData,
        });

        if (response.ok) {
            // Si es exitoso, FastAPI debería devolver un 'access_token'
            const data = await response.json();
            
            // --- Guardamos el Token y los datos del usuario ---
            localStorage.setItem('userToken', data.access_token);
            // También guardamos los datos del usuario (que vendrán de otro endpoint)
            // Aquí simulamos que obtenemos los datos del cliente
            await fetchAndStoreUserData(data.access_token);

            alert('¡Inicio de sesión exitoso!');
            window.location.href = 'profile.html'; // Redirige al perfil

        } else {
            const error = await response.json();
            console.error('Error en login:', error);
            alert(`Error: ${error.detail || 'Email o contraseña incorrectos.'}`);
        }
    } catch (error) {
        console.error('Error de red:', error);
        alert('Error de conexión. Inténtalo de nuevo.');
    }
}

/**
 * Función auxiliar para obtener datos del usuario DESPUÉS del login
 * y guardarlos en localStorage para usarlos en el perfil.
 */
async function fetchAndStoreUserData(token) {
    try {
        // --- CONECTAR API ---
        // Endpoint protegido que devuelve los datos del usuario logueado
        // (Ej: /clientes/me)
        const response = await fetch(`${API_BASE_URL}/clientes/me`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const userData = await response.json();
            // Guardamos al usuario como un string JSON
            localStorage.setItem('user', JSON.stringify(userData));
        } else {
            throw new Error('No se pudieron cargar los datos del usuario.');
        }
    } catch (error) {
        console.error(error);
    }
}


/**
 * Maneja el clic en "Cerrar Sesión"
 */
function handleLogout(e) {
    e.preventDefault();
    
    // Limpiar el almacenamiento
    localStorage.removeItem('userToken');
    localStorage.removeItem('user');
    
    alert('Has cerrado sesión.');
    window.location.href = 'index.html'; // Redirige al inicio
}