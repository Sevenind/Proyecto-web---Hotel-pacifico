from database import db
from models import Cliente, TipoHabitacion, Habitacion, Reserva
from services.cliente_services import *

def inicializar_db():
    
    lista_de_modelos = [Cliente, TipoHabitacion, Habitacion, Reserva]
    
    try:
        
        db.connect()
        db.create_tables(lista_de_modelos, safe=True)
        print("Base de datos y tablas creadas exitosamente.")

    except Exception as e:
        print(f"Error al crear las tablas: {e}")
        
    finally:
        if not db.is_closed():
            db.close()
# --- NUEVA FUNCIÓN DE PRUEBA ---
def probar_registro():
    print("\n--- Probando registro de cliente ---")
    
    # Intenta registrar un nuevo cliente
    # La conexión se maneja dentro de 'registrar_cliente'
    cliente_ana = registrar_cliente(
        dni=12345678,
        nombre="Ana",
        apellido="García",
        email="ana.garcia@email.com",
        telefono=987654321,
        password="micontraseña123"
    )


def probar_inicio_sesion():
    print("\n--- Probando inicio de sesión ---")

    email = input("Ingresa tu email: ")
    password = input("Ingresa tu contraseña: ")

    cliente = iniciar_sesion(email, password)
    if cliente:
        print(f"¡Éxito! Sesión iniciada para: {cliente.nombre} (ID: {cliente.dni})")
    else:
        print("Error al iniciar sesión.")

def probar_actualizacion():
    print("\n--- Probando actualización de cliente ---")

    dni = int(input("Ingresa tu DNI: "))
    nuevo_email = input("Ingresa tu nuevo email (o deja vacío para no cambiar): ")
    nuevo_telefono = input("Ingresa tu nuevo teléfono (o deja vacío para no cambiar): ")
    nuevo_password = input("Ingresa tu nueva contraseña (o deja vacío para no cambiar): ")

    # Convertir teléfono a entero si se proporciona
    telefono_int = int(nuevo_telefono) if nuevo_telefono else None
    email_str = nuevo_email if nuevo_email else None
    password_str = nuevo_password if nuevo_password else None

    cliente_actualizado = modificar_cliente_datos(
        dni_cliente=dni,
        email=email_str,
        telefono=telefono_int,
        password=password_str
    )

    if cliente_actualizado:
        print(f"¡Éxito! Cliente actualizado: {cliente_actualizado.nombre} (ID: {cliente_actualizado.dni})")
    else:
        print("Error al actualizar el cliente.")


if __name__ == "__main__":
    print("Iniciando aplicación...")
    inicializar_db()
    probar_registro()
    probar_inicio_sesion()
    #probar_actualizacion()
    
    print("Aplicación lista.")
    
    # A partir de aquí, podrías iniciar tu servidor web,
    # o ejecutar otras funciones de tu app.