from peewee import *
from datetime import date
from typing import List

# 1. Importa todos los modelos necesarios y la base de datos
from ..models import Cliente, TipoHabitacion, Habitacion, Reserva
from ..database import db

def crear_reserva(dni_cliente: int, tipo_habitacion_id: int, fecha_checkin: date, fecha_checkout: date, total_personas: int):
    """
    Crea una nueva reserva en la base de datos.
    
    Busca una habitación disponible del tipo solicitado y
    que no se solape con otras reservas existentes.
    """
    
    # 1. Validación inicial de fechas
    if fecha_checkout <= fecha_checkin:
        print("Error: La fecha de check-out debe ser posterior a la de check-in.")
        return None # O puedes lanzar una excepción

    try:
        # 2. Usar db.atomic() para una transacción segura
        # O todo funciona, o nada se guarda si hay un error.
        with db.atomic():
            
            # 3. Obtener el tipo de habitación y verificar capacidad
            try:
                # Buscamos el tipo de habitación que el cliente quiere
                tipo_hab = TipoHabitacion.get_by_id(tipo_habitacion_id)
            except TipoHabitacion.DoesNotExist:
                print(f"Error: El tipo de habitación {tipo_habitacion_id} no existe.")
                return None
                
            # Verificamos si la capacidad es suficiente
            if total_personas > tipo_hab.capacidad_maxima:
                print(f"Error: El número de personas ({total_personas}) excede la capacidad máxima ({tipo_hab.capacidad_maxima}).")
                return None

         
            reservas_solapadas = Reserva.select(Reserva.habitacion).where(
                (Reserva.fecha_checkin < fecha_checkout) &
                (Reserva.fecha_checkout > fecha_checkin) &
                (Reserva.estado_reserva != 'Cancelada') 
            )
          
            habitaciones_ocupadas_ids = [r.habitacion.id for r in reservas_solapadas]
            
            habitacion_disponible = Habitacion.select().where(
                (Habitacion.tipo == tipo_hab) &
                (Habitacion.estado == 'Activa') &
                (Habitacion.id.not_in(habitaciones_ocupadas_ids))
            ).first() # .first() nos da el primer resultado o None si no hay

            # Si no se encontró ninguna, no hay disponibilidad
            if not habitacion_disponible:
                print("Error: No hay habitaciones de ese tipo disponibles para las fechas seleccionadas.")
                return None

            # 6. Calcular el costo total
            dias_estadia = (fecha_checkout - fecha_checkin).days
            costo_calculado = dias_estadia * tipo_hab.tarifa_base

            # 7. Crear la reserva
            nueva_reserva = Reserva.create(
                cliente=dni_cliente, # Peewee manejará la FK al DNI del cliente
                habitacion=habitacion_disponible, # Peewee manejará la FK al ID de la habitación
                fecha_checkin=fecha_checkin,
                fecha_checkout=fecha_checkout,
                total_personas=total_personas,
                costo_total=costo_calculado,
                estado_reserva='Confirmada' # Estado por defecto al crear
            )
            
            print(f"¡Reserva {nueva_reserva.id} creada exitosamente para la habitación {habitacion_disponible.numero}!")
            return nueva_reserva

    except IntegrityError as e:
        # Esto podría pasar si hay algún problema con las FK (ej. cliente no existe)
        print(f"Error de integridad al crear la reserva: {e}")
        return None
        
    except Exception as e:
        # Captura cualquier otro error inesperado
        print(f"Ocurrió un error inesperado en crear_reserva: {e}")
        return None
    

def obtener_reservas_por_cliente(dni_cliente: int) -> List[Reserva]:
    """
    Obtiene todas las reservas de un cliente específico.
    
    Realiza un JOIN para incluir los datos de la habitación 
    y el tipo de habitación, que son necesarios para el 
    schema 'ReservaPublica' de la API.
    """
    try:
      
        reservas_query = (Reserva
                          .select()
                          .join(Habitacion)
                          .join(TipoHabitacion)
                          .where(Reserva.cliente == dni_cliente)
                          .order_by(Reserva.fecha_checkin.desc())) # Opcional: ordenar
        
        # 2. Devolvemos la lista de resultados
        return list(reservas_query)

    except Exception as e:
        print(f"Error al obtener reservas para el DNI {dni_cliente}: {e}")
        return [] # Devolver una lista vacía en caso de error
    
def modificar_reserva(reserva_id: int, dni_cliente: int, nueva_fecha_checkin: date, nueva_fecha_checkout: date, nuevo_total_personas: int):
    """
    Modifica una reserva existente, si es del cliente correcto
    y si la habitación sigue disponible en las nuevas fechas.
    """
    
    # 1. Validación inicial de fechas
    if nueva_fecha_checkout <= nueva_fecha_checkin:
        print("Error: La fecha de check-out debe ser posterior a la de check-in.")
        return None

    try:
        with db.atomic():
            # 2. Encontrar la reserva y verificar propiedad
            # Hacemos JOIN para obtener el tipo de habitación y su capacidad
            reserva = (Reserva
                       .select(Reserva, Habitacion, TipoHabitacion)
                       .join(Habitacion)
                       .join(TipoHabitacion)
                       .where(
                           (Reserva.id == reserva_id) &
                           (Reserva.cliente == dni_cliente) &
                           (Reserva.estado_reserva == 'Confirmada')
                       ).first()) # .first() es crucial aquí

            if not reserva:
                print(f"Error: No se encontró la reserva {reserva_id} o no pertenece al cliente {dni_cliente}.")
                return None
            
            # 3. Verificar nueva capacidad
            tipo_hab = reserva.habitacion.tipo
            if nuevo_total_personas > tipo_hab.capacidad_maxima:
                print(f"Error: El nuevo total de personas ({nuevo_total_personas}) excede la capacidad.")
                return None

            # 4. Verificar disponibilidad de la *misma habitación* en las *nuevas fechas*
            # Debemos excluir la reserva actual (reserva_id) de la comprobación
            
            reservas_solapadas = Reserva.select().where(
                (Reserva.habitacion == reserva.habitacion) &
                (Reserva.fecha_checkin < nueva_fecha_checkout) &
                (Reserva.fecha_checkout > nueva_fecha_checkin) &
                (Reserva.estado_reserva != 'Cancelada') &
                (Reserva.id != reserva_id) # <-- Excluir esta misma reserva
            )

            if reservas_solapadas.exists():
                print(f"Error: La habitación {reserva.habitacion.numero} no está disponible para las nuevas fechas.")
                return None
                
            # 5. Todo en orden: Actualizar la reserva
            
            # Recalcular costo
            dias_estadia = (nueva_fecha_checkout - nueva_fecha_checkin).days
            costo_calculado = dias_estadia * tipo_hab.tarifa_base

            reserva.fecha_checkin = nueva_fecha_checkin
            reserva.fecha_checkout = nueva_fecha_checkout
            reserva.total_personas = nuevo_total_personas
            reserva.costo_total = costo_calculado
            
            reserva.save()
            
            print(f"Reserva {reserva_id} modificada exitosamente.")
            return reserva

    except Exception as e:
        print(f"Ocurrió un error inesperado en modificar_reserva: {e}")
        return None

def cancelar_reserva(reserva_id: int, dni_cliente: int):
    """
    Cambia el estado de una reserva a 'Cancelada'.
    Verifica que la reserva pertenezca al cliente.
    """
    try:
        with db.atomic():
            reserva = Reserva.get_or_none(
                (Reserva.id == reserva_id) &
                (Reserva.cliente == dni_cliente)
            )

            if not reserva:
                print(f"Error: No se encontró la reserva {reserva_id} o no pertenece al cliente {dni_cliente}.")
                return None
            
            if reserva.estado_reserva == 'Cancelada':
                print(f"La reserva {reserva_id} ya estaba cancelada.")
                return reserva

            reserva.estado_reserva = 'Cancelada'
            reserva.save()
            
            print(f"Reserva {reserva_id} cancelada exitosamente.")
            return reserva

    except Exception as e:
        print(f"Ocurrió un error inesperado en cancelar_reserva: {e}")
        return None
    
def obtener_reservas_por_dni_admin(dni_cliente: int) -> List[Reserva]:
    """
    (Admin) Obtiene todas las reservas de un DNI de cliente específico.
    
    Realiza JOINs para incluir datos de Cliente, Habitación y Tipo,
    necesarios para el schema 'ReservaPublicaAdmin'.
    
    (Ahora filtra las canceladas)
    """
    try:
        query = (Reserva
                 .select()
                 .join(Cliente)
                 .switch(Reserva) 
                 .join(Habitacion)
                 .join(TipoHabitacion)
                 .where(
                     (Reserva.cliente == dni_cliente) & 
                     (Reserva.estado_reserva != 'Cancelada')
                 )
                 .order_by(Reserva.fecha_checkin.desc()))
    
        
        return list(query)

    except Exception as e:
        print(f"Error al obtener reservas (admin) para DNI {dni_cliente}: {e}")
        return []

def obtener_reservas_por_fechas_admin(fecha_inicio: date, fecha_fin: date) -> List[Reserva]:
    """
    (Admin) Obtiene todas las reservas entre un rango de fechas.
    ...
    """
    try:
        query = (Reserva
                 .select()
                 .join(Cliente)
                 .switch(Reserva)
                 .join(Habitacion)
                 .join(TipoHabitacion)
                 .where(
                     (Reserva.fecha_checkin < fecha_fin) &
                     (Reserva.fecha_checkout > fecha_inicio) &
                     (Reserva.estado_reserva != 'Cancelada')
                 )
                 .order_by(Reserva.fecha_checkin.asc()))
        return list(query)

    except Exception as e:
        print(f"Error al obtener reservas (admin) por fechas: {e}")
        return []