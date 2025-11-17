from werkzeug.security import check_password_hash
from ..models import Admin, Habitacion, TipoHabitacion
from ..database import db
from datetime import date

# 1. Importa tus modelos
from ..models import Admin

def iniciar_sesion_admin(username, password):
    """
    Verifica las credenciales del Administrador.
    Compara la contraseña hasheada.
    """

    try:
        # Busca al admin por 'username' en lugar de 'email'
        admin = Admin.get(Admin.username == username)
        
        # Verificar la contraseña
        if check_password_hash(admin.password, password):
            return admin  # Credenciales válidas
        else:
            print("Contraseña de admin incorrecta.")
            return None

    except Admin.DoesNotExist:
        print(f"No existe un admin con el username: {username}")
        return None

    except Exception as e:
        print(f"Ocurrió un error inesperado: {e}")
        return None
    
def admin_obtener_todas_las_habitaciones():
    """
    [Admin] Obtiene una lista de TODAS las habitaciones.
    Hacemos un JOIN con TipoHabitacion para que el frontend
    pueda mostrar el nombre del tipo.
    """
    try:
        # Hacemos JOIN para incluir los datos del tipo de habitación
        habitaciones = (Habitacion
                        .select()
                        .join(TipoHabitacion)
                        .order_by(Habitacion.numero)) # Ordenadas por número
        
        return list(habitaciones)
    except Exception as e:
        print(f"Error al obtener todas las habitaciones: {e}")
        return []

def admin_actualizar_estado_habitacion(habitacion_id: int, nuevo_estado: str):
    """
    [Admin] Actualiza el estado de una habitación.
    Según tu nueva lógica, no validamos conflictos.
    """
    try:
        with db.atomic():
            habitacion = Habitacion.get_or_none(Habitacion.id == habitacion_id)
            
            if not habitacion:
                return None, "Habitación no encontrada"

            # Validar que el estado sea uno de los permitidos
            if nuevo_estado not in ['Activa', 'Mantenimiento']:
                return None, "Estado no válido"
            
            # --- LÓGICA SIMPLIFICADA ---
            # Simplemente actualizamos el estado
            habitacion.estado = nuevo_estado
            habitacion.save()
            
            # Devolvemos la habitación (con el tipo ya cargado si se obtuvo con JOIN,
            # aunque aquí no lo hicimos, pero el endpoint lo necesita)
            
            # Volvemos a consultar con el JOIN para devolver el objeto completo
            hab_actualizada = (Habitacion
                               .select(Habitacion, TipoHabitacion)
                               .join(TipoHabitacion)
                               .where(Habitacion.id == habitacion_id)
                               .first())
            
            return hab_actualizada, "Estado actualizado"

    except Exception as e:
        print(f"Error actualizando estado: {e}")
        return None, f"Error interno: {e}"