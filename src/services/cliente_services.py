from peewee import IntegrityError
from werkzeug.security import generate_password_hash, check_password_hash

# 1. Importa tus modelos y la base de datos
from ..models import Cliente
from ..database import db

def registrar_cliente(dni, nombre, apellido, email, password, telefono):
    """
    Registra un nuevo cliente en la base de datos.
    Hashea la contraseña para seguridad.
    """
    try:
        # 2. Hashear la contraseña
        # En lugar de guardar la 'password' en texto plano...
        # guardamos su 'hash'
        password_hash = generate_password_hash(password)

        # 3. Usar db.atomic()
        # Esto asegura que la operación es "atómica": o se completa
        # exitosamente, o se revierte (rollback) si falla.
        # También maneja la conexión por nosotros.
        with db.atomic():
            nuevo_cliente = Cliente.create(
                dni=dni,
                nombre=nombre,
                apellido=apellido,
                email=email,
                telefono=telefono,
                password=password_hash  # <-- Guardamos el hash
            )
        
        # 4. Devuelve el cliente si tuvo éxito
        return nuevo_cliente

    except IntegrityError as e:
        # 5. Manejar errores de unicidad (DNI o email duplicados)
        # str(e) nos dice qué restricción falló
        if "clientes.dni" in str(e):
            print(f"Error: El DNI {dni} ya está registrado.")
        elif "clientes.email" in str(e):
            print(f"Error: El email {email} ya está registrado.")
        else:
            print(f"Error de integridad: {e}")
        
        # Devuelve None para indicar que falló
        return None

    except Exception as e:
        print(f"Ocurrió un error inesperado: {e}")
        return None
    

def iniciar_sesion(email, password):
    """
    Verifica las credenciales del cliente para iniciar sesión.
    Compara la contraseña hasheada.
    """

    try:
        cliente = Cliente.get(Cliente.email == email)
        
        # Verificar la contraseña
        if check_password_hash(cliente.password, password):
            return cliente  # Credenciales válidas
        else:
            print("Contraseña incorrecta.")
            return None

    except Cliente.DoesNotExist:
        print(f"No existe un cliente con el email: {email}")
        return None

    except Exception as e:
        print(f"Ocurrió un error inesperado: {e}")
        return None


def modificar_cliente_datos(dni_cliente, email=None, telefono=None, password=None):
    """
    Modifica los datos de un cliente (email, telefono, password).
    Los campos que se pasan como None no se modifican.
    """
    try:
        # 1. Usar db.atomic() para una transacción segura
        with db.atomic():
            
            # .get_or_none() es más seguro que .get()
            cliente = Cliente.get_or_none(Cliente.dni == dni_cliente)

            if not cliente:
                print(f"No existe un cliente con el DNI: {dni_cliente}")
                return None
            
            campos_actualizados = 0
            
            # 2. Actualizar solo los campos que no son None
            if email is not None:
                cliente.email = email
                campos_actualizados += 1
                
            if telefono is not None:
                cliente.telefono = telefono
                campos_actualizados += 1
                
            if password is not None:
                # 3. Hashear la nueva contraseña
                cliente.password = generate_password_hash(password)
                campos_actualizados += 1

            # 4. Guardar solo si algo cambió
            if campos_actualizados > 0:
                cliente.save()
                print(f"Datos del cliente {dni_cliente} actualizados.")
                return cliente
            else:
                print("No se proporcionaron datos nuevos para modificar.")
                return cliente # Devuelve el cliente sin cambios

    except IntegrityError as e:
        # Esto atrapará si el nuevo email ya existe
        if "clientes.email" in str(e):
            print(f"Error: El nuevo email '{email}' ya está en uso.")
        else:
            print(f"Error de integridad: {e}")
        return None # La transacción se revierte
        
    except Exception as e:
        print(f"Ocurrió un error inesperado al modificar: {e}")
        return None
    

def obtener_todos_los_clientes():
    """
    (Admin) Obtiene una lista de todos los clientes.
    """
    try:
        # Devuelve una lista de todos los objetos Cliente
        return list(Cliente.select())
    except Exception as e:
        print(f"Error al obtener todos los clientes: {e}")
        return []