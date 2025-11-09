from werkzeug.security import check_password_hash

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