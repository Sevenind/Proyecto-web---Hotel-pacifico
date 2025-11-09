// ==============================================================================
// CONSTANTES GLOBALES
// ==============================================================================

// URL base de tu API de FastAPI
const API_BASE_URL = 'http://127.0.0.1:8000/api/v1';

// ==============================================================================
// EVENT LISTENER PRINCIPAL (AL CARGAR LA PÁGINA)
// ==============================================================================

document.addEventListener('DOMContentLoaded', () => {
    
    // Revisa si el usuario está logueado y actualiza el NAV
    checkLoginState();

    // --- Inicialización del Carrusel (Swiper) ---
    // Solo se activa si estamos en index.html (donde existe .room-carousel)
    const roomCarousel = document.querySelector('.room-carousel');
    if (roomCarousel) {
        const swiper = new Swiper('.room-carousel', {
            loop: true,
            slidesPerView: 1, // Muestra 1 slide a la vez
            spaceBetween: 30,
            centeredSlides: true, // Mantiene la slide centrada
            // Botones de Navegación
            navigation: {
                nextEl: '.swiper-button-next',
                prevEl: '.swiper-button-prev',
            },
        });
    }

    // --- Inicialización del Modal de Habitaciones (index.html) ---
    const roomModal = document.getElementById('room-detail-modal');
    const closeModalBtn = document.getElementById('close-room-modal');
    const modalRoomName = document.getElementById('modal-room-name');
    const modalRoomDesc = document.getElementById('modal-room-desc');
    const modalRoomCapacity = document.getElementById('modal-room-capacity');
    const modalBookBtn = document.getElementById('modal-book-now-btn');
    const allRoomCards = document.querySelectorAll('.swiper-slide .room-card');

    // Listener para ABRIR el modal (clic en tarjeta)
    allRoomCards.forEach(card => {
        card.addEventListener('click', () => {
            
            const modalRoomImage = document.getElementById('modal-room-image');
            
            // Obtener datos desde los atributos data-* del HTML
            const name = card.dataset.name;
            const desc = card.dataset.desc;
            const capacity = card.dataset.capacity;
            const img_src = card.dataset.img; 

            // Rellenar el modal con esa información
            if(modalRoomImage) modalRoomImage.src = img_src;
            if(modalRoomName) modalRoomName.textContent = name;
            if(modalRoomDesc) modalRoomDesc.textContent = desc;
            if(modalRoomCapacity) modalRoomCapacity.textContent = `Capacidad: ${capacity} personas.`;

            // Lógica de autenticación para el botón de reservar
            const token = localStorage.getItem('userToken');
            if (token) {
                // Si está logueado, el botón va a crear-reserva
                if(modalBookBtn) modalBookBtn.href = 'crear-reserva.html';
            } else {
                // Si NO está logueado, el botón va a registrarse
                if(modalBookBtn) modalBookBtn.href = 'register.html';
            }

            // Mostrar el modal
            if (roomModal) roomModal.classList.remove('hidden');
        });
    });

    // Listener para CERRAR el modal (botón 'x')
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            if (roomModal) roomModal.classList.add('hidden');
        });
    }

    // Listener para CERRAR el modal (clic en el fondo)
    if (roomModal) {
        roomModal.addEventListener('click', (e) => {
            if (e.target === roomModal) {
                roomModal.classList.add('hidden');
            }
        });
    }

    // --- Listeners para Formularios (Login, Registro, Logout) ---
    
    // Asigna el listener al formulario de Login (si existe en esta página)
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Asigna el listener al formulario de Registro (si existe en esta página)
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }
    
    // Asigna el listener al botón de Logout (si existe en esta página)
    const logoutBtn = document.getElementById('nav-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
});

// ==============================================================================
// FUNCIONES DE ESTADO Y AUTENTICACIÓN (NAVBAR Y LOGOUT)
// ==============================================================================

/**
 * Revisa si existe un token en localStorage y actualiza 
 * los botones del Navbar (NAV) en consecuencia.
 */
function checkLoginState() {
    const userToken = localStorage.getItem('userToken');
    
    // IDs de los botones del NAV
    const navLogin = document.getElementById('nav-login');
    const navRegister = document.getElementById('nav-register');
    const navProfile = document.getElementById('nav-profile');
    const navLogout = document.getElementById('nav-logout');
    const heroBookBtn = document.getElementById('hero-book-btn'); // Botón del 'Hero'

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

/**
 * Maneja el clic en "Cerrar Sesión".
 * Limpia el localStorage y redirige al inicio.
 */
function handleLogout(e) {
    e.preventDefault();
    
    // Limpiar el almacenamiento
    localStorage.removeItem('userToken');
    localStorage.removeItem('user');
    window.location.href = 'index.html'; // Redirige al inicio
}


// ==============================================================================
// FUNCIONES DE FORMULARIOS (LOGIN Y REGISTRO)
// ==============================================================================

/**
 * (CONECTAR API) Maneja el envío del formulario de REGISTRO
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

    // Crear el cuerpo de la petición (debe coincidir con el schema 'ClienteCreate')
    const userData = {
        dni: parseInt(dni),
        nombre: nombre,
        apellido: apellido,
        email: email,
        telefono: parseInt(telefono),
        password: password
    };

    try {
        // --- CONECTAR API (Registro) ---
        // Endpoint: /clientes/register (POST)
        const response = await fetch(`${API_BASE_URL}/clientes/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(userData),
        });

        if (response.ok) {
            const nuevoCliente = await response.json(); 
            console.log('Registro exitoso:', nuevoCliente);
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
 * (CONECTAR API) Maneja el envío del formulario de LOGIN
 */
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    // Obtener el elemento de error y ocultarlo
    const loginErrorMsg = document.getElementById('login-error-msg');
    loginErrorMsg.classList.add('hidden'); // Ocultarlo al re-intentar
    loginErrorMsg.textContent = ''; // Limpiar texto

    // Para FastAPI/OAuth2, se envían datos de formulario
    const formData = new URLSearchParams();
    formData.append('username', email); // FastAPI espera 'username' para el email
    formData.append('password', password);

    try {
        // --- CONECTAR API (Login) ---
        // Endpoint: /clientes/login/token (POST)
        const response = await fetch(`${API_BASE_URL}/clientes/login/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData,
        });

        if (response.ok) {
            // Si es exitoso, FastAPI devuelve el 'access_token'
            const data = await response.json();
            
            // Guardamos el Token
            localStorage.setItem('userToken', data.access_token);
            
            // Obtenemos y guardamos los datos del usuario (/me)
            await fetchAndStoreUserData(data.access_token);

            // Redirección directa al perfil
            window.location.href = 'profile.html'; 

        } else {
            const error = await response.json();
            console.error('Error en login:', error);

            // Mostrar error en la página
            loginErrorMsg.textContent = error.detail || 'Email o contraseña incorrectos.';
            loginErrorMsg.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Error de red:', error);
        
        // Mostrar error de red en la página
        loginErrorMsg.textContent = 'Error de conexión. Inténtalo de nuevo.';
        loginErrorMsg.classList.remove('hidden');
    }
}

// ==============================================================================
// FUNCIÓN AUXILIAR (OBTENER DATOS DE USUARIO)
// ==============================================================================

/**
 * (CONECTAR API) Obtiene datos del usuario (usando el token)
 * y los guarda en localStorage para usarlos en el perfil.
 */
async function fetchAndStoreUserData(token) {
    try {
        // --- CONECTAR API (Obtener datos del usuario) ---
        // Endpoint: /clientes/me (GET)
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