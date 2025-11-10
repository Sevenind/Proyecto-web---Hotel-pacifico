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

#  Lista de orígenes permitidos (para que el frontend se conecte) 
origins = [
    "http://localhost:5500",
    "http://127.0.0.1:5500"
    
]

#  Aplicar el middleware de CORS 
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==============================================================================
# ESQUEMAS (PYDANTIC MODELS) - EN ESPAÑOL
# ==============================================================================

#  Esquemas de Cliente 

class ClienteCrear(BaseModel):
    dni: int
    nombre: str
    apellido: str
    email: EmailStr
    password: str
    telefono: int    

class ClienteActualizar(BaseModel):
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
             
#  Esquemas de Habitación (para anidar en Reservas) 
             
class InfoTipoHabitacion(BaseModel):
    nombre_tipo: str
    
    class Config:
         from_attributes = True

class InfoHabitacion(BaseModel):
    numero: str
    tipo: InfoTipoHabitacion
    
    class Config:
         from_attributes = True

#  Esquemas de Reserva 

class ReservaCrear(BaseModel):
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
    habitacion: InfoHabitacion

    class Config:
         from_attributes = True

class ReservaActualizar(BaseModel):
    fecha_checkin: date
    fecha_checkout: date
    total_personas: int

#  Esquemas de Administración 
    
class InfoClienteAdmin(BaseModel):
    dni: int
    nombre: str

    class Config:
        from_attributes = True

class ReservaPublicaAdmin(BaseModel):
    id: int
    fecha_checkin: date
    fecha_checkout: date
    estado_reserva: str
    habitacion: InfoHabitacion
    cliente: InfoClienteAdmin

    class Config:
        from_attributes = True

#  Esquemas de Token (Autenticación) 

class DatosToken(BaseModel):
    dni: Optional[int] = None

class Token(BaseModel):
    access_token: str
    token_type: str

# ==============================================================================
# CONFIGURACIÓN DE AUTENTICACIÓN (JWT) - EN ESPAÑOL
# ==============================================================================

# Define el esquema de seguridad
# APUNTAMOS A LA NUEVA RUTA DE LOGIN EN ESPAÑOL
esquema_oauth2 = OAuth2PasswordBearer(tokenUrl="/api/v1/clientes/iniciar_sesion")

# Constantes de seguridad 
CLAVE_SECRETA = "m!8$zKq@9#R2bT(7G%5vPqR!fTjWnZr4u7x!A%D*G-KaPdSgVkYp3s" 
ALGORITMO = "HS256"
MINUTOS_EXPIRACION_TOKEN = 60 # El token durará 1 hora

# ==============================================================================
# FUNCIONES HELPERS DE AUTENTICACIÓN - EN ESPAÑOL
# ==============================================================================

def crear_token_acceso(data: dict, expires_delta: Optional[timedelta] = None):
    """Crea un nuevo token JWT."""
    a_codificar = data.copy()
    if expires_delta:
        expira = datetime.utcnow() + expires_delta
    else:
        expira = datetime.utcnow() + timedelta(minutes=MINUTOS_EXPIRACION_TOKEN)
        
    a_codificar.update({"exp": expira})
    jwt_codificado = jwt.encode(a_codificar, CLAVE_SECRETA, algorithm=ALGORITMO)
    return jwt_codificado


async def obtener_usuario_actual(token: str = Depends(esquema_oauth2)):
    """
    Obtiene el usuario cliente actual a partir del token JWT.
    """
    excepcion_credenciales = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudieron validar las credenciales",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, CLAVE_SECRETA, algorithms=[ALGORITMO])
        dni: str = payload.get("sub") 
        if dni is None:
            raise excepcion_credenciales
        datos_token = DatosToken(dni=int(dni))
        
    except JWTError:
        raise excepcion_credenciales
    
    usuario = Cliente.get_or_none(Cliente.dni == datos_token.dni)
    
    if usuario is None:
        raise excepcion_credenciales
        
    return usuario

async def obtener_usuario_admin_actual(token: str = Depends(esquema_oauth2)):
    """
    Obtiene el usuario admin actual a partir del token JWT.
    Verifica el flag 'is_admin'.
    """
    excepcion_credenciales = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No tienes permisos de administrador",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, CLAVE_SECRETA, algorithms=[ALGORITMO])
        username: str = payload.get("sub") 
        es_admin: bool = payload.get("is_admin", False)
        
        if username is None or es_admin is not True:
            raise excepcion_credenciales
        
    except JWTError:
        raise excepcion_credenciales
    
    usuario_admin = Admin.get_or_none(Admin.username == username)
    
    if usuario_admin is None:
        raise excepcion_credenciales
        
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
            #  Crear Admin por defecto 
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
def evento_inicio():
    """Se ejecuta al iniciar la app: Conecta a la BD e inicializa."""
    if db.is_closed():
        db.connect()
    inicializar_db() 

# Evento de Cierre
@app.on_event("shutdown")
def evento_cierre():
    """Se ejecuta al apagar la app: Cierra la conexión a la BD."""
    if not db.is_closed():
        db.close()
        print("Conexión a la BD cerrada.")


# ==============================================================================
# ENDPOINTS DE LA API (RUTAS Y FUNCIONES EN ESPAÑOL)
# ==============================================================================

#  Endpoints de Cliente 

@app.post("/api/v1/clientes/registrar", response_model=ClientePublico)
def endpoint_registrar_cliente(datos_cliente: ClienteCrear):
    """Endpoint para registrar un nuevo cliente."""
    
    print(f"Recibida petición de registro para DNI: {datos_cliente.dni}")
    try:
        nuevo_cliente = registrar_cliente(
            dni=datos_cliente.dni,
            nombre=datos_cliente.nombre,
            apellido=datos_cliente.apellido,
            email=datos_cliente.email,
            password=datos_cliente.password,
            telefono=datos_cliente.telefono
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

@app.get("/api/v1/clientes/yo", response_model=ClientePublico)
def endpoint_obtener_datos_usuario(
    usuario_actual: Cliente = Depends(obtener_usuario_actual)
):
    """Endpoint protegido para obtener los datos del usuario logueado."""
    return usuario_actual

@app.put("/api/v1/clientes/{dni_cliente}", response_model=ClientePublico)
def endpoint_modificar_cliente(
    dni_cliente: int,
    datos: ClienteActualizar,
    usuario_actual: Cliente = Depends(obtener_usuario_actual)
):
    """Endpoint protegido para modificar los datos del usuario logueado."""
    
    #  Verificación de seguridad 
    if dni_cliente != usuario_actual.dni:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permiso para modificar este usuario"
        )
    
    try:
        cliente_actualizado = modificar_cliente_datos(
            dni_cliente=usuario_actual.dni,
            email=datos.email,
            telefono=datos.telefono,
            password=datos.password
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

#  Endpoints de Autenticación (Login Tokens) 
        
@app.post("/api/v1/clientes/iniciar_sesion", response_model=Token)
def endpoint_login_para_token_cliente(
    datos_formulario: OAuth2PasswordRequestForm = Depends()
):
    """Endpoint de Login para Clientes."""
    
    cliente = iniciar_sesion(
        email=datos_formulario.username, 
        password=datos_formulario.password
    )
    if not cliente:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    #  Crear Token de Cliente 
    expiracion_token = timedelta(minutes=MINUTOS_EXPIRACION_TOKEN)
    token_acceso = crear_token_acceso(
        data={"sub": str(cliente.dni)}, # Guardamos el DNI en el token
        expires_delta=expiracion_token
    )
    return {"access_token": token_acceso, "token_type": "bearer"}

@app.post("/api/v1/admin/iniciar_sesion", response_model=Token)
def endpoint_login_para_token_admin(
    datos_formulario: OAuth2PasswordRequestForm = Depends()
):
    """Endpoint de Login SÓLO para Administradores."""
    
    admin = iniciar_sesion_admin(
        username=datos_formulario.username, 
        password=datos_formulario.password
    )
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Username o contraseña de admin incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Crear Token de Admin 
    expiracion_token = timedelta(minutes=MINUTOS_EXPIRACION_TOKEN)
    token_acceso = crear_token_acceso(
        data={"sub": admin.username, "is_admin": True}, # Guardamos flag de admin
        expires_delta=expiracion_token
    )
    return {"access_token": token_acceso, "token_type": "bearer"}


#  Endpoints de Reservas (Cliente) 

@app.post("/api/v1/reservas/", response_model=ReservaPublica)
def endpoint_crear_reserva(
    datos_reserva: ReservaCrear, 
    usuario_actual: Cliente = Depends(obtener_usuario_actual)
):
    """Endpoint protegido para crear una nueva reserva"""
    
    print(f"Recibida petición de reserva de DNI: {usuario_actual.dni}")
    try:
        nueva_reserva = crear_reserva(
            dni_cliente=usuario_actual.dni,
            tipo_habitacion_id=datos_reserva.tipo_habitacion_id,
            fecha_checkin=datos_reserva.fecha_checkin,
            fecha_checkout=datos_reserva.fecha_checkout,
            total_personas=datos_reserva.total_personas
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
        
@app.get("/api/v1/reservas/mis_reservas", response_model=List[ReservaPublica])
def endpoint_obtener_reservas_del_usuario(
    usuario_actual: Cliente = Depends(obtener_usuario_actual)
):
    """Endpoint protegido para obtener la LISTA de reservas del usuario logueado."""
    
    print(f"Buscando reservas para el DNI: {usuario_actual.dni}")
    reservas = obtener_reservas_por_cliente(dni_cliente=usuario_actual.dni)
    return reservas

@app.put("/api/v1/reservas/{reserva_id}", response_model=ReservaPublica)
def endpoint_modificar_reserva(
    reserva_id: int,
    datos_reserva: ReservaActualizar,
    usuario_actual: Cliente = Depends(obtener_usuario_actual)
):
    """Endpoint protegido para modificar una reserva existente."""
    
    print(f"Modificando reserva {reserva_id} para DNI: {usuario_actual.dni}")
    try:
        reserva_modificada = modificar_reserva(
            reserva_id=reserva_id,
            dni_cliente=usuario_actual.dni,
            nueva_fecha_checkin=datos_reserva.fecha_checkin,
            nueva_fecha_checkout=datos_reserva.fecha_checkout,
            nuevo_total_personas=datos_reserva.total_personas
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
    usuario_actual: Cliente = Depends(obtener_usuario_actual)
):
    """Endpoint protegido para cancelar (cambiar estado) una reserva."""
    
    print(f"Cancelando reserva {reserva_id} para DNI: {usuario_actual.dni}")
    try:
        reserva_cancelada = cancelar_reserva(
            reserva_id=reserva_id,
            dni_cliente=usuario_actual.dni
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

#  Endpoints de Administración (Búsquedas)   

@app.get("/api/v1/admin/reservas/cliente/{dni}", response_model=List[ReservaPublicaAdmin])
def endpoint_admin_buscar_por_dni(
    dni: int,
    usuario_admin: Admin = Depends(obtener_usuario_admin_actual) 
):
    """ Admin busca todas las reservas de un DNI de cliente específico"""
    
    print(f"Búsqueda [Admin] por DNI: {dni}")
    reservas = obtener_reservas_por_dni_admin(dni_cliente=dni)
    return reservas


@app.get("/api/v1/admin/reservas/fechas", response_model=List[ReservaPublicaAdmin])
def endpoint_admin_buscar_por_fechas(
    fecha_inicio: date,
    fecha_fin: date,
    usuario_admin: Admin = Depends(obtener_usuario_admin_actual) 
):
    """[Admin] Busca todas las reservas entre un rango de fechas."""
    
    print(f"Búsqueda [Admin] por Fechas: {fecha_inicio} a {fecha_fin}")
    reservas = obtener_reservas_por_fechas_admin(
        fecha_inicio=fecha_inicio, 
        fecha_fin=fecha_fin
    )
    return reservas