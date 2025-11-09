from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from jose import JWTError, jwt
from datetime import datetime, timedelta, date
from typing import Optional, List
from werkzeug.security import generate_password_hash
from .database import db
from .models import Cliente, TipoHabitacion, Habitacion, Reserva, Admin
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
from .services.admin_services import iniciar_sesion_admin

# ==============================================================================
# CONFIGURACIÓN DE APP Y CORS
# ==============================================================================
app = FastAPI()

# --- Lista de orígenes permitidos (para que el frontend se conecte) ---
origins = [
    "http://localhost",
    "http://localhost:5500",
    "http://127.0.0.1",
    "http://127.0.0.1:5500",
    "null"
]

# --- Aplicar el middleware de CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==============================================================================
# ESQUEMAS (PYDANTIC MODELS)
# ==============================================================================

# --- Esquemas de Cliente ---

class ClienteCreate(BaseModel):
    dni: int
    nombre: str
    apellido: str
    email: EmailStr
    password: str
    telefono: int    

class ClienteUpdate(BaseModel):
    email: Optional[EmailStr] = None
    telefono: Optional[int] = None
    password: Optional[str] = None
    
class ClientePublico(BaseModel):
    dni: int
    nombre: str
    apellido: str
    email: EmailStr
    telefono: int

    class Config:
         from_attributes = True
             
# --- Esquemas de Habitación (para anidar en Reservas) ---
             
class TipoHabitacionInfo(BaseModel):
    nombre_tipo: str
    
    class Config:
         from_attributes = True

class HabitacionInfo(BaseModel):
    numero: str
    tipo: TipoHabitacionInfo
    
    class Config:
         from_attributes = True

# --- Esquemas de Reserva ---

class ReservaCreate(BaseModel):
    tipo_habitacion_id: int
    fecha_checkin: date
    fecha_checkout: date
    total_personas: int

class ReservaPublica(BaseModel):
    id: int
    fecha_checkin: date
    fecha_checkout: date
    estado_reserva: str
    costo_total: Optional[int] = None
    habitacion: HabitacionInfo

    class Config:
         from_attributes = True

class ReservaUpdate(BaseModel):
    fecha_checkin: date
    fecha_checkout: date
    total_personas: int

# --- Esquemas de Administración ---
    
class ClienteInfoAdmin(BaseModel):
    dni: int
    nombre: str

    class Config:
        from_attributes = True

class ReservaPublicaAdmin(BaseModel):
    id: int
    fecha_checkin: date
    fecha_checkout: date
    estado_reserva: str
    habitacion: HabitacionInfo
    cliente: ClienteInfoAdmin

    class Config:
        from_attributes = True

# --- Esquemas de Token (Autenticación) ---

class TokenData(BaseModel):
    dni: Optional[int] = None

class Token(BaseModel):
    access_token: str
    token_type: str

# ==============================================================================
# CONFIGURACIÓN DE AUTENTICACIÓN (JWT)
# ==============================================================================

#  Define el esquema de seguridad
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/clientes/login/token")

# Constantes de seguridad 
SECRET_KEY = "tu-clave-secreta-muy-larga-y-dificil-de-adivinar" # ¡Cambia esto en producción!
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 # El token durará 1 hora

# ==============================================================================
# FUNCIONES HELPERS DE AUTENTICACIÓN
# ==============================================================================

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Crea un nuevo token JWT."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


async def get_current_user(token: str = Depends(oauth2_scheme)):
    

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
   
   
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No tienes permisos de administrador",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub") 
        is_admin: bool = payload.get("is_admin", False)
        
        if username is None or is_admin is not True:
            raise credentials_exception
        
    except JWTError:
        raise credentials_exception
    
    usuario_admin = Admin.get_or_none(Admin.username == username)
    
    if usuario_admin is None:
        raise credentials_exception
        
    return usuario_admin
        
# ==============================================================================
# EVENTOS DE INICIO Y CIERRE (STARTUP/SHUTDOWN)
# ==============================================================================

def inicializar_db():
    
    
    lista_de_modelos = [Cliente, TipoHabitacion, Habitacion, Reserva, Admin]
    
    try:
        db.create_tables(lista_de_modelos, safe=True)
        print("Tablas verificadas/creadas.")

        with db.atomic():
            # --- Crear Admin por defecto ---
            if Admin.select().count() == 0:
                print("Creando usuario admin por defecto (hotelp / admin1234)...")
                Admin.create(
                    username='hotelp',
                    password=generate_password_hash('admin1234')
                )
                print("Usuario admin creado.")
            
            if Habitacion.select().count() == 0:
                print("Base de datos vacía. Creando tipos y habitaciones...")
                
                # Crear Tipos de Habitación 
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

                # Crear Habitaciones 
                print("Creando 10 habitaciones 'Normal (King Size)' (Piso 1)...")
                for i in range(1, 11):
                    Habitacion.create(numero=f'1{i:02d}', tipo=tipo_normal, estado='Activa')

                print("Creando 9 habitaciones 'Individual' (Piso 2)...")
                for i in range(1, 10):
                    Habitacion.create(numero=f'2{i:02d}', tipo=tipo_individual, estado='Activa')
                
                print("Creando 9 habitaciones 'Grande (Familiar)' (Piso 3)...")
                for i in range(1, 10):
                    Habitacion.create(numero=f'3{i:02d}', tipo=tipo_familiar, estado='Activa')
                
                print("Creando 2 habitaciones 'Suite' (Piso 4)...")
                for i in range(1, 3):
                    Habitacion.create(numero=f'4{i:02d}', tipo=tipo_suite, estado='Activa')
                
                print("¡Éxito! 4 Tipos y 30 Habitaciones creadas.")

            else:
                print("La base de datos ya contiene habitaciones. No se crearon datos nuevos.")

    except Exception as e:
        print(f"Error al inicializar la base de datos: {e}")
        
# Evento de Inicio
@app.on_event("startup")
def startup_event():
    """Se ejecuta al iniciar la app: Conecta a la BD e inicializa."""
    if db.is_closed():
        db.connect()
    inicializar_db() 

# Evento de Cierre
@app.on_event("shutdown")
def shutdown_event():
    """Se ejecuta al apagar la app: Cierra la conexión a la BD."""
    if not db.is_closed():
        db.close()
        print("Conexión a la BD cerrada.")


# ==============================================================================
# ENDPOINTS DE LA API
# ==============================================================================

# Endpoints de Cliente 

@app.post("/api/v1/clientes/register", response_model=ClientePublico)
def endpoint_registrar_cliente(cliente_data: ClienteCreate):
    """Endpoint para registrar un nuevo cliente."""
    
    print(f"Recibida petición de registro para DNI: {cliente_data.dni}")
    try:
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

@app.get("/api/v1/clientes/me", response_model=ClientePublico)
def endpoint_read_users_me(current_user: Cliente = Depends(get_current_user)):
    """Endpoint protegido para obtener los datos del usuario logueado."""
    return current_user

@app.put("/api/v1/clientes/{dni_cliente}", response_model=ClientePublico)
def endpoint_modificar_cliente(
    dni_cliente: int,
    data: ClienteUpdate,
    current_user: Cliente = Depends(get_current_user)
):
    """Endpoint protegido para modificar los datos del usuario logueado."""
    
    #  Verificación de seguridad 
    if dni_cliente != current_user.dni:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permiso para modificar este usuario"
        )
    
    try:
        cliente_actualizado = modificar_cliente_datos(
            dni_cliente=current_user.dni,
            email=data.email,
            telefono=data.telefono,
            password=data.password
        )
        if not cliente_actualizado:
            raise HTTPException(
                status_code=400,
                detail="Error al actualizar. El email podría estar en uso."
            )
        
        return cliente_actualizado
    except Exception as e:
        print(f"Error inesperado en endpoint_modificar_cliente: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Error interno del servidor: {e}"
        )

# --- Endpoints de Autenticación (Login Tokens) ---
        
@app.post("/api/v1/clientes/login/token", response_model=Token)
def endpoint_login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    """Endpoint de Login para Clientes."""
    
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
    
    # --- Crear Token de Cliente ---
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(cliente.dni)}, # Guardamos el DNI en el token
        expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/api/v1/admin/login/token", response_model=Token)
def endpoint_admin_login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    """Endpoint de Login SÓLO para Administradores."""
    
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
    
    # Crear Token de Admin 
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": admin.username, "is_admin": True}, # Guardamos flag de admin
        expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


# Endpoints de Reservas (Cliente) 

@app.post("/api/v1/reservas/", response_model=ReservaPublica)
def endpoint_crear_reserva(
    reserva_data: ReservaCreate, 
    current_user: Cliente = Depends(get_current_user)
):
    """Endpoint protegido para crear una nueva reserva"""
    
    print(f"Recibida petición de reserva de DNI: {current_user.dni}")
    try:
        nueva_reserva = crear_reserva(
            dni_cliente=current_user.dni,
            tipo_habitacion_id=reserva_data.tipo_habitacion_id,
            fecha_checkin=reserva_data.fecha_checkin,
            fecha_checkout=reserva_data.fecha_checkout,
            total_personas=reserva_data.total_personas
        )
        if not nueva_reserva:
            raise HTTPException(
                status_code=400,
                detail="No hay disponibilidad para las fechas o datos seleccionados."
            )
        return nueva_reserva
    except Exception as e:
        print(f"Error inesperado en crear_reserva: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Error interno del servidor: {e}"
        )
        
@app.get("/api/v1/reservas/me", response_model=List[ReservaPublica])
def endpoint_obtener_reservas_del_usuario(
    current_user: Cliente = Depends(get_current_user)
):
    """Endpoint protegido para obtener la LISTA de reservas del usuario logueado."""
    
    print(f"Buscando reservas para el DNI: {current_user.dni}")
    reservas = obtener_reservas_por_cliente(dni_cliente=current_user.dni)
    return reservas

@app.put("/api/v1/reservas/{reserva_id}", response_model=ReservaPublica)
def endpoint_modificar_reserva(
    reserva_id: int,
    reserva_data: ReservaUpdate,
    current_user: Cliente = Depends(get_current_user)
):
    """Endpoint protegido para modificar una reserva existente."""
    
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
            raise HTTPException(
                status_code=400,
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
    """Endpoint protegido para cancelar (cambiar estado) una reserva."""
    
    print(f"Cancelando reserva {reserva_id} para DNI: {current_user.dni}")
    try:
        reserva_cancelada = cancelar_reserva(
            reserva_id=reserva_id,
            dni_cliente=current_user.dni
        )
        if not reserva_cancelada:
            raise HTTPException(
                status_code=404,
                detail="No se encontró la reserva o no pertenece al usuario."
            )
        return reserva_cancelada
    except Exception as e:
        print(f"Error inesperado en endpoint_cancelar_reserva: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Error interno del servidor: {e}"
        )

# Endpoints de Administración (Búsquedas)

@app.get("/api/v1/admin/reservas/cliente/{dni}", response_model=List[ReservaPublicaAdmin])
def endpoint_admin_buscar_por_dni(
    dni: int,
    current_user: Admin = Depends(get_current_admin_user) 
):
    """ Admin busca todas las reservas de un DNI de cliente específico"""
    
    print(f"Búsqueda [Admin] por DNI: {dni}")
    reservas = obtener_reservas_por_dni_admin(dni_cliente=dni)
    return reservas


@app.get("/api/v1/admin/reservas/fechas", response_model=List[ReservaPublicaAdmin])
def endpoint_admin_buscar_por_fechas(
    fecha_inicio: date,
    fecha_fin: date,
    current_user: Admin = Depends(get_current_admin_user) 
):
    """[Admin] Busca todas las reservas entre un rango de fechas."""
    
    print(f"Búsqueda [Admin] por Fechas: {fecha_inicio} a {fecha_fin}")
    reservas = obtener_reservas_por_fechas_admin(
        fecha_inicio=fecha_inicio, 
        fecha_fin=fecha_fin
    )
    return reservas