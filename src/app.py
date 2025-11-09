
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timedelta, date
from typing import Optional, List
from jose import JWTError, jwt
from fastapi import Depends, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from .database import db
from .models import Cliente, TipoHabitacion, Habitacion, Reserva, Admin
from pydantic import BaseModel, EmailStr
from .services.cliente_services import (
    registrar_cliente, 
    iniciar_sesion, 
    modificar_cliente_datos
)
from .services.reserva_services import (
    crear_reserva,
    obtener_reservas_por_cliente,
    modificar_reserva,
    cancelar_reserva,
    obtener_reservas_por_dni_admin,
    obtener_reservas_por_fechas_admin
)
from .services.admin_services import iniciar_sesion_admin # <-- AÑADIR ESTA LÍNEA
from werkzeug.security import generate_password_hash
app = FastAPI()

origins = [
    "http://localhost",
    "http://localhost:5500",  # Puerto común de VSCode Live Server
    "http://127.0.0.1",
    "http://127.0.0.1:5500", # El mismo, pero con la IP
    "null"                    # Importante para permitir 'file://' (si abres el HTML)
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ClienteCreate(BaseModel):
    """
    Esquema para VALIDAR los datos que el frontend (register.html)
    envía al crear un cliente.
    """
    dni: int
    nombre: str
    apellido: str
    email: EmailStr
    password: str
    telefono: int    

class ClienteUpdate(BaseModel):
    """
    Esquema para VALIDAR los datos que el frontend
    envía al modificar el perfil.
    """
    email: Optional[EmailStr] = None
    telefono: Optional[int] = None
    password: Optional[str] = None
    
class ClientePublico(BaseModel):
    """
    Esquema para ENVIAR datos del cliente al frontend.
    ¡¡NUNCA debe incluir la contraseña!!
    """
    dni: int
    nombre: str
    apellido: str
    email: EmailStr
    telefono: int

    class Config:
       
        class Config:
             from_attributes = True
             
class TipoHabitacionInfo(BaseModel):
    """ Muestra solo info relevante del Tipo de Habitación """
    nombre_tipo: str
    
    class Config:
         from_attributes = True

class HabitacionInfo(BaseModel):
    """ Muestra solo info relevante de la Habitación """
    numero: str
    tipo: TipoHabitacionInfo # <-- Modelo anidado
    
    class Config:
         from_attributes = True

# --- (NUEVO) Schemas para Reservas ---

class ReservaCreate(BaseModel):
    """
    Esquema para VALIDAR los datos que el frontend (profile.js)
    envía al crear una reserva.
    """
    tipo_habitacion_id: int
    fecha_checkin: date
    fecha_checkout: date
    total_personas: int

class ReservaPublica(BaseModel):
    """
    Esquema para ENVIAR datos de una reserva al frontend.
    """
    id: int
    fecha_checkin: date
    fecha_checkout: date
    estado_reserva: str
    costo_total: Optional[int] = None
    habitacion: HabitacionInfo # <-- Modelo anidado

    class Config:
         from_attributes = True

class ReservaUpdate(BaseModel):
    """
    Esquema para VALIDAR los datos que el frontend
    envía al modificar una reserva.
    """
    fecha_checkin: date
    fecha_checkout: date
    total_personas: int
    
class ClienteInfoAdmin(BaseModel):
    """ Muestra solo info del cliente para el admin """
    dni: int
    nombre: str

    class Config:
        from_attributes = True

class ReservaPublicaAdmin(BaseModel):
    """
    Esquema para ENVIAR datos de una reserva al panel de admin.
    Incluye info del cliente.
    """
    id: int
    fecha_checkin: date
    fecha_checkout: date
    estado_reserva: str
    habitacion: HabitacionInfo # <-- Ya existe
    cliente: ClienteInfoAdmin  # <-- Nuevo schema anidado

    class Config:
        from_attributes = True

# --- (NUEVO) Esquemas para Tokens ---
class TokenData(BaseModel):
    """ Esquema interno para los datos que guardamos en el Token """
    dni: Optional[int] = None

class Token(BaseModel):
    """ El esquema que le devolvemos al frontend cuando se loguea """
    access_token: str
    token_type: str

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/clientes/login/token")

# --- ¡MUY IMPORTANTE! ---
# Cambia esta clave por una cadena larga y aleatoria.
SECRET_KEY = "tu-clave-secreta-muy-larga-y-dificil-de-adivinar"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 # El token durará 1 hora


# --- SECCIÓN 5: (NUEVO) FUNCIONES AYUDANTES DE AUTENTICACIÓN ---

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """
    Crea un nuevo token JWT.
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


async def get_current_user(token: str = Depends(oauth2_scheme)):
    """
    Dependencia de FastAPI: Valida el token y devuelve
    el cliente (modelo Peewee) si es válido.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudieron validar las credenciales",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        dni: str = payload.get("sub") 
        if dni is None:
            raise credentials_exception
        token_data = TokenData(dni=int(dni))
        
    except JWTError:
        raise credentials_exception
    
    usuario = Cliente.get_or_none(Cliente.dni == token_data.dni)
    
    if usuario is None:
        raise credentials_exception
        
    return usuario

async def get_current_admin_user(token: str = Depends(oauth2_scheme)):
    """
    (NUEVO) Dependencia de FastAPI: Valida el token y devuelve
    el admin si es un token de admin válido.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No tienes permisos de administrador",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub") 
        is_admin: bool = payload.get("is_admin", False) # Buscamos el flag de admin
        
        if username is None or is_admin is not True:
            raise credentials_exception
        
    except JWTError:
        raise credentials_exception
    
    usuario_admin = Admin.get_or_none(Admin.username == username)
    
    if usuario_admin is None:
        raise credentials_exception
        
    return usuario_admin
        

def inicializar_db():
    """
    Se ejecuta al iniciar la app.
    Crea las tablas y si la DB está vacía, la "siembra"
    con los datos iniciales de habitaciones según tu imagen.
    """
    lista_de_modelos = [Cliente, TipoHabitacion, Habitacion, Reserva, Admin]
    
    try:
        # Nota: La conexión (db.connect()) se maneja
        # en el evento @app.on_event("startup")
        
        db.create_tables(lista_de_modelos, safe=True)
        print("Tablas verificadas/creadas.")

        # Usamos 'atomic' para que todo se cree
        # o nada se cree si hay un error.
        with db.atomic():
            
            # --- (NUEVO) Bloque para crear el Admin ---
            if Admin.select().count() == 0:
                print("Creando usuario admin por defecto (hotelp / admin1234)...")
                Admin.create(
                    username='hotelp',
                    password=generate_password_hash('admin1234')
                )
                print("Usuario admin creado.")
            # --- Fin del nuevo bloqu
            
            # Solo "sembramos" si la tabla de habitaciones está vacía
            if Habitacion.select().count() == 0:
                print("Base de datos vacía. Creando tipos de habitación y 30 habitaciones (según tu imagen)...")
                
                # --- 1. Crear los Tipos de Habitación (de tu imagen) ---
                # (He supuesto la capacidad y tarifa, puedes cambiarlas)

                tipo_normal = TipoHabitacion.create(
                    nombre_tipo='Normal (King Size)',
                    descripcion='Habitación estándar con cama King Size.',
                    capacidad_maxima=2,
                    tarifa_base=9000,
                    cantidad_total=10
                )
                
                tipo_individual = TipoHabitacion.create(
                    nombre_tipo='Individual',
                    descripcion='Habitación para una persona.',
                    capacidad_maxima=1,
                    tarifa_base=6000,
                    cantidad_total=9
                )
                
                tipo_familiar = TipoHabitacion.create(
                    nombre_tipo='Grande (Familiar)',
                    descripcion='Habitación amplia para familias.',
                    capacidad_maxima=4,
                    tarifa_base=12000,
                    cantidad_total=9
                )
                
                tipo_suite = TipoHabitacion.create(
                    nombre_tipo='Suite',
                    descripcion='Suite de lujo con sala de estar.',
                    capacidad_maxima=3,
                    tarifa_base=18000,
                    cantidad_total=2
                )

                # --- 2. Crear las Habitaciones (de tu imagen) ---
                
                print("Creando 10 habitaciones 'Normal (King Size)' (Piso 1)...")
                for i in range(1, 11): # Bucle para crear 10 (del 1 al 10)
                    Habitacion.create(numero=f'1{i:02d}', tipo=tipo_normal, estado='Activa')

                print("Creando 9 habitaciones 'Individual' (Piso 2)...")
                for i in range(1, 10): # Bucle para crear 9 (del 1 al 9)
                    Habitacion.create(numero=f'2{i:02d}', tipo=tipo_individual, estado='Activa')
                
                print("Creando 9 habitaciones 'Grande (Familiar)' (Piso 3)...")
                for i in range(1, 10): # Bucle para crear 9 (del 1 al 9)
                    Habitacion.create(numero=f'3{i:02d}', tipo=tipo_familiar, estado='Activa')
                
                print("Creando 2 habitaciones 'Suite' (Piso 4)...")
                for i in range(1, 3): # Bucle para crear 2 (del 1 al 2)
                    Habitacion.create(numero=f'4{i:02d}', tipo=tipo_suite, estado='Activa')
                
                print("¡Éxito! 4 Tipos y 30 Habitaciones creadas.")

            else:
                # Si ya hay datos, no hacer nada
                print("La base de datos ya contiene habitaciones. No se crearon datos nuevos.")

    except Exception as e:
        print(f"Error al inicializar la base de datos: {e}")
        

# ---  EVENTOS DE APP (Startup/Shutdown) ---

@app.on_event("startup")
def startup_event():
    """
    Se ejecuta al iniciar la app.
    Conecta a la BD y la inicializa.
    """
    if db.is_closed():
        db.connect()
    
    inicializar_db() 

@app.on_event("shutdown")
def shutdown_event():
    """
    Se ejecuta al apagar la app.
    Cierra la conexión a la BD.
    """
    if not db.is_closed():
        db.close()
        print("Conexión a la BD cerrada.")


# --- SECCIÓN 6: ENDPOINTS DE API (Las "Rutas") ---

# (NUEVO) Este es tu primer endpoint
@app.post("/api/v1/clientes/register", response_model=ClientePublico)
def endpoint_registrar_cliente(cliente_data: ClienteCreate):
    """
    Endpoint para registrar un nuevo cliente.
    """
    
    print(f"Recibida petición de registro para DNI: {cliente_data.dni}")

    try:
        # 1. Llamamos a tu servicio (la "cocina")
        nuevo_cliente = registrar_cliente(
            dni=cliente_data.dni,
            nombre=cliente_data.nombre,
            apellido=cliente_data.apellido,
            email=cliente_data.email,
            password=cliente_data.password,
            telefono=cliente_data.telefono
        )
        
        if not nuevo_cliente:
            raise HTTPException(
                status_code=400, 
                detail="El DNI o Email ya están registrados."
            )
       
        return nuevo_cliente

    except Exception as e:
        print(f"Error inesperado en registro: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Error interno del servidor: {e}"
        )
        
# --- (NUEVO) Endpoint de Login (Token) ---
@app.post("/api/v1/clientes/login/token", response_model=Token)
def endpoint_login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    """
    Endpoint de Login. Recibe email y password como 'form data'.
    """
    # 'form_data.username' es el email (así lo envía main.js)
    cliente = iniciar_sesion(
        email=form_data.username, 
        password=form_data.password
    )
    
    if not cliente:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Creamos el Token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        # Guardamos el DNI del cliente dentro del token
        data={"sub": str(cliente.dni)}, 
        expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

# --- (NUEVO) Endpoint de Login de ADMIN ---
@app.post("/api/v1/admin/login/token", response_model=Token)
def endpoint_admin_login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    """
    Endpoint de Login SÓLO para Administradores.
    """
    # 'form_data.username' es el username ('hotelp')
    admin = iniciar_sesion_admin(
        username=form_data.username, 
        password=form_data.password
    )
    
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Username o contraseña de admin incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Creamos el Token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        # Guardamos datos diferentes en el token de admin
        data={"sub": admin.username, "is_admin": True}, 
        expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

# --- (NUEVO) Endpoint protegido "/me" ---
@app.get("/api/v1/clientes/me", response_model=ClientePublico)
def endpoint_read_users_me(current_user: Cliente = Depends(get_current_user)):
    """
    Endpoint protegido para obtener los datos del usuario logueado.
    'Depends(get_current_user)' hace toda la magia de validación.
    """
    # Si el token es válido, 'current_user' es el objeto Cliente
    # Tu main.js llama a esto 
    # justo después del login.
    return current_user
@app.put("/api/v1/clientes/{dni_cliente}", response_model=ClientePublico)
def endpoint_modificar_cliente(
    dni_cliente: int,
    data: ClienteUpdate, # <-- Usa el nuevo Schema
    current_user: Cliente = Depends(get_current_user)
):
    """
    Endpoint protegido para modificar los datos (email, tel, pass)
    del usuario logueado.
    """
    
    # 1. Verificación de seguridad:
    # Asegurarse de que el DNI en la URL es el mismo
    # que el DNI del token (un usuario solo puede modificarse a sí mismo).
    if dni_cliente != current_user.dni:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permiso para modificar este usuario"
        )
    
    try:
        # 2. Llamar al servicio que ya tenías hecho
        # El .password, .email, etc. serán None si no se enviaron
        cliente_actualizado = modificar_cliente_datos(
            dni_cliente=current_user.dni,
            email=data.email,
            telefono=data.telefono,
            password=data.password
        )
        
        if not cliente_actualizado:
            # Esto pasaría si el servicio devuelve None (ej: email duplicado)
            raise HTTPException(
                status_code=400,
                detail="Error al actualizar. El email podría estar en uso."
            )
        
        # 3. Devolver el cliente con los datos actualizados
        return cliente_actualizado

    except Exception as e:
        print(f"Error inesperado en endpoint_modificar_cliente: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Error interno del servidor: {e}"
        )

@app.post("/api/v1/reservas/", response_model=ReservaPublica)
def endpoint_crear_reserva(
    reserva_data: ReservaCreate, 
    current_user: Cliente = Depends(get_current_user)
):
    
    print(f"Recibida petición de reserva de DNI: {current_user.dni}")
    
    try:
        # 1. Llamamos a tu servicio
        nueva_reserva = crear_reserva(
            dni_cliente=current_user.dni, # <--- DNI del token
            tipo_habitacion_id=reserva_data.tipo_habitacion_id,
            fecha_checkin=reserva_data.fecha_checkin,
            fecha_checkout=reserva_data.fecha_checkout,
            total_personas=reserva_data.total_personas
        )
        
        # 2. Manejar error del servicio (si devuelve None)
        if not nueva_reserva:
            # Tu servicio imprimirá el error específico en la consola
            raise HTTPException(
                status_code=400, # 400 Bad Request
                detail="No hay disponibilidad para las fechas o datos seleccionados."
            )

        # 3. Éxito: 'response_model=ReservaPublica' formatea la respuesta
        return nueva_reserva

    except Exception as e:
        # Capturar cualquier otro error
        print(f"Error inesperado en crear_reserva: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Error interno del servidor: {e}"
        )
        
@app.get("/api/v1/reservas/me", response_model=List[ReservaPublica])
def endpoint_obtener_reservas_del_usuario(
    current_user: Cliente = Depends(get_current_user)
):
    """
    Endpoint protegido para obtener la LISTA de reservas
    del usuario actualmente logueado.
    
    Es llamado por 'loadUserReservations()' en profile.js.
    """
    
    print(f"Buscando reservas para el DNI: {current_user.dni}")
    
    # 1. Llamamos a tu nuevo servicio
    reservas = obtener_reservas_por_cliente(dni_cliente=current_user.dni)
    
    # 2. Retornamos la lista.
    # El 'response_model=List[ReservaPublica]' se encarga 
    # automáticamente de formatear la salida.
    return reservas

@app.put("/api/v1/reservas/{reserva_id}", response_model=ReservaPublica)
def endpoint_modificar_reserva(
    reserva_id: int,
    reserva_data: ReservaUpdate, # El schema que ya tenías definido
    current_user: Cliente = Depends(get_current_user)
):
    """
    Endpoint protegido para modificar una reserva existente.
    """
    print(f"Modificando reserva {reserva_id} para DNI: {current_user.dni}")
    
    try:
        reserva_modificada = modificar_reserva(
            reserva_id=reserva_id,
            dni_cliente=current_user.dni,
            nueva_fecha_checkin=reserva_data.fecha_checkin,
            nueva_fecha_checkout=reserva_data.fecha_checkout,
            nuevo_total_personas=reserva_data.total_personas
        )
        
        if not reserva_modificada:
            # El servicio_reserva imprimirá el error específico
            raise HTTPException(
                status_code=400, # 400 Bad Request
                detail="No se pudo modificar la reserva (verifique disponibilidad o propiedad)."
            )
        
        return reserva_modificada

    except Exception as e:
        print(f"Error inesperado en endpoint_modificar_reserva: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Error interno del servidor: {e}"
        )


@app.delete("/api/v1/reservas/{reserva_id}", response_model=ReservaPublica)
def endpoint_cancelar_reserva(
    reserva_id: int,
    current_user: Cliente = Depends(get_current_user)
):
    """
    Endpoint protegido para cancelar (cambiar estado) una reserva.
    """
    print(f"Cancelando reserva {reserva_id} para DNI: {current_user.dni}")
    
    try:
        reserva_cancelada = cancelar_reserva(
            reserva_id=reserva_id,
            dni_cliente=current_user.dni
        )
        
        if not reserva_cancelada:
            raise HTTPException(
                status_code=404, # 404 Not Found
                detail="No se encontró la reserva o no pertenece al usuario."
            )
        
        return reserva_cancelada

    except Exception as e:
        print(f"Error inesperado en endpoint_cancelar_reserva: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Error interno del servidor: {e}"
        )

# --- (NUEVO) ENDPOINTS DE ADMINISTRACIÓN ---

@app.get("/api/v1/admin/reservas/cliente/{dni}", response_model=List[ReservaPublicaAdmin])
def endpoint_admin_buscar_por_dni(
    dni: int,
    # (MODIFICADO) Cambia 'get_current_user' por 'get_current_admin_user'
    current_user: Admin = Depends(get_current_admin_user) 
):
    """
    [Admin] Busca todas las reservas de un DNI específico.
    """
    print(f"Búsqueda [Admin] por DNI: {dni}")
    reservas = obtener_reservas_por_dni_admin(dni_cliente=dni)
    return reservas


@app.get("/api/v1/admin/reservas/fechas", response_model=List[ReservaPublicaAdmin])
def endpoint_admin_buscar_por_fechas(
    fecha_inicio: date,
    fecha_fin: date,
    # (MODIFICADO) Cambia 'get_current_user' por 'get_current_admin_user'
    current_user: Admin = Depends(get_current_admin_user)
):
    """
    [Admin] Busca todas las reservas entre dos fechas.
    """
    print(f"Búsqueda [Admin] por Fechas: {fecha_inicio} a {fecha_fin}")
    reservas = obtener_reservas_por_fechas_admin(
        fecha_inicio=fecha_inicio, 
        fecha_fin=fecha_fin
    )
    return reservas