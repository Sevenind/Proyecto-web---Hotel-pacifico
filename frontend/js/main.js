const API_BASE_URL = 'http://127.0.0.1:8000/api/v1';

// ==============================================================================
// EVENTLISTENER PRINCIPAL (AL CARGAR LA PÁGINA)
// ==============================================================================

document.addEventListener('DOMContentLoaded', () => {
    
    // Revisa si el usuario está logueado y actualiza el NAV
    verificarEstadoLogin(); 

    //  Inicialización del Carrusel (Swiper) 
    const roomCarousel = document.querySelector('.room-carousel');
    if (roomCarousel) {
        const swiper = new Swiper('.room-carousel', {
            loop: true,
            slidesPerView: 1, 
            spaceBetween: 30,
            centeredSlides: true, 
            navigation: {
                nextEl: '.swiper-button-next',
                prevEl: '.swiper-button-prev',
            },
        });
    }

    //  Inicialización del Modal de Habitaciones (index.html) 
    // (Esta parte no usa la API, se queda igual)
    const roomModal = document.getElementById('room-detail-modal');
    const closeModalBtn = document.getElementById('close-room-modal');
    const modalRoomName = document.getElementById('modal-room-name');
    const modalRoomDesc = document.getElementById('modal-room-desc');
    const modalRoomCapacity = document.getElementById('modal-room-capacity');
    const modalBookBtn = document.getElementById('modal-book-now-btn');
    const allRoomCards = document.querySelectorAll('.swiper-slide .room-card');

    allRoomCards.forEach(card => {
        card.addEventListener('click', () => {
            
            const modalRoomImage = document.getElementById('modal-room-image');
            const name = card.dataset.name;
            const desc = card.dataset.desc;
            const capacity = card.dataset.capacity;
            const img_src = card.dataset.img; 

            if(modalRoomImage) modalRoomImage.src = img_src;
            if(modalRoomName) modalRoomName.textContent = name;
            if(modalRoomDesc) modalRoomDesc.textContent = desc;
            if(modalRoomCapacity) modalRoomCapacity.textContent = `Capacidad: ${capacity} personas.`;

            const token = localStorage.getItem('userToken');
            if (token) {
                if(modalBookBtn) modalBookBtn.href = 'crear-reserva.html';
            } else {
                if(modalBookBtn) modalBookBtn.href = 'register.html';
            }

            if (roomModal) roomModal.classList.remove('hidden');
        });
    });

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            if (roomModal) roomModal.classList.add('hidden');
        });
    }
    if (roomModal) {
        roomModal.addEventListener('click', (e) => {
            if (e.target === roomModal) {
                roomModal.classList.add('hidden');
            }
        });
    }

    // Listeners para Formularios (Login, Registro, Logout) 
    
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', manejarLogin); 
    }
    
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', manejarRegistro); 
    }
    
    const logoutBtn = document.getElementById('nav-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', manejarLogout); 
    }
});

// ==============================================================================
// FUNCIONES DE ESTADO Y AUTENTICACIÓN (NAVBAR Y LOGOUT)
// ==============================================================================

// Revisa si existe un token en localStorage y actualiza los botones del Navbar (NAV) en consecuencia.
function verificarEstadoLogin() { 
    const userToken = localStorage.getItem('userToken');
    
    // IDs de los botones del NAV
    const navLogin = document.getElementById('nav-login');
    const navRegister = document.getElementById('nav-register');
    const navProfile = document.getElementById('nav-profile');
    const navLogout = document.getElementById('nav-logout');
    const heroBookBtn = document.getElementById('hero-book-btn'); 

    if (userToken) {
        //  Usuario LOGUEADO 
        if (navLogin) navLogin.classList.add('hidden');
        if (navRegister) navRegister.classList.add('hidden');
        if (navProfile) navProfile.classList.remove('hidden');
        if (navLogout) navLogout.classList.remove('hidden');
        
        if (heroBookBtn) {
            heroBookBtn.href = "profile.html#new-reservation";
        }
        
    } else {
        //  Usuario NO LOGUEADO 
        if (navLogin) navLogin.classList.remove('hidden');
        if (navRegister) navRegister.classList.remove('hidden');
        if (navProfile) navProfile.classList.add('hidden');
        if (navLogout) navLogout.classList.add('hidden');

        if (heroBookBtn) {
            heroBookBtn.href = "register.html";
        }
    }
}

// Maneja el clic en "Cerrar Sesión" limpia el localStorage y redirige al inicio.
function manejarLogout(e) { 
    e.preventDefault();
    
    localStorage.removeItem('userToken');
    localStorage.removeItem('user');
    
    // También limpiamos el token de admin, por si acaso
    localStorage.removeItem('adminToken'); 
    
    window.location.href = 'index.html'; // Redirige al inicio
}


// ==============================================================================
// FUNCIONES DE FORMULARIOS (LOGIN Y REGISTRO)
// ==============================================================================

// (CONECTAR API) Maneja el envío del formulario de REGISTRO
async function manejarRegistro(e) { // <-- CAMBIADO
    e.preventDefault(); // Evita que la página se recargue

    // Obtener datos del formulario de registro
    const dni = document.getElementById('dni').value;
    const nombre = document.getElementById('nombre').value;
    const apellido = document.getElementById('apellido').value;
    const email = document.getElementById('email').value;
    const telefono = document.getElementById('telefono').value;
    const password = document.getElementById('password').value;

    const userData = {
        dni: parseInt(dni),
        nombre: nombre,
        apellido: apellido,
        email: email,
        telefono: parseInt(telefono),
        password: password
    };

    try {
        // CONECTAR API (Registro)
        // Endpoint: /clientes/registrar 
        const response = await fetch(`${API_BASE_URL}/clientes/registrar`, { 
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(userData),
        });

        if (response.ok) {
            const nuevoCliente = await response.json(); 
            console.log('Registro exitoso:', nuevoCliente);
            alert('¡Registro exitoso! Ahora puedes iniciar sesión.');
            window.location.href = 'login.html'; 
            const error = await response.json();
            console.error('Error en registro:', error);
            alert(`Error: ${error.detail || 'No se pudo completar el registro.'}`);
        }

    } catch (error) {
        console.error('Error de red:', error);
        alert('Error de conexión. Inténtalo de nuevo.');
    }
}


// (CONECTAR API) Maneja el envío del formulario de LOGIN
async function manejarLogin(e) { 
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const loginErrorMsg = document.getElementById('login-error-msg');
    loginErrorMsg.classList.add('hidden');
    loginErrorMsg.textContent = ''; 

    const formData = new URLSearchParams();
    formData.append('username', email); 
    formData.append('password', password);

    try {
        // CONECTAR API (Login) 
        // Endpoint: /clientes/iniciar_sesion
        const response = await fetch(`${API_BASE_URL}/clientes/iniciar_sesion`, { 
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData,
        });

        if (response.ok) {
            const data = await response.json();
            localStorage.setItem('userToken', data.access_token);
            
            // Obtenemos y guardamos los datos del usuario (/yo)
            await obtenerYGuardarDatosUsuario(data.access_token); 

            window.location.href = 'profile.html'; 

        } else {
            const error = await response.json();
            console.error('Error en login:', error);
            loginErrorMsg.textContent = error.detail || 'Email o contraseña incorrectos.';
            loginErrorMsg.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Error de red:', error);
        loginErrorMsg.textContent = 'Error de conexión. Inténtalo de nuevo.';
        loginErrorMsg.classList.remove('hidden');
    }
}

// ==============================================================================
// FUNCIÓN AUXILIAR (OBTENER DATOS DE USUARIO)
// ==============================================================================

// (CONECTAR API) Obtiene datos del usuario (usando el token) y los guarda en localStorage
async function obtenerYGuardarDatosUsuario(token) { 
    try {
        // CONECTAR API (Obtener datos del usuario) 
        // Endpoint: /clientes/yo (GET)
        const response = await fetch(`${API_BASE_URL}/clientes/yo`, { 
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const userData = await response.json();
            localStorage.setItem('user', JSON.stringify(userData));
        } else {
            throw new Error('No se pudieron cargar los datos del usuario.');
        }
    } catch (error) {
        console.error(error);
        // Si falla (ej. token expira), limpiamos
        handleLogout(new Event('click'));
    }
}