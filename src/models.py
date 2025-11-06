import peewee
from peewee import Model
from .database import BaseModel


class Cliente(BaseModel):
    dni = peewee.IntegerField(primary_key=True, unique=True, index=True)
    nombre = peewee.CharField(max_length=100)
    apellido = peewee.CharField(max_length=100)
    email = peewee.CharField(max_length=255, unique=True)
    telefono = peewee.IntegerField()
    password = peewee.CharField(max_length=255) # Guarda texto plano (Inseguro)

    class Meta:
        table_name = 'clientes'

class TipoHabitacion(BaseModel):
    id = peewee.AutoField() # PK estándar
    nombre_tipo = peewee.CharField(max_length=50, unique=True)
    descripcion = peewee.TextField(null=True)
    capacidad_maxima = peewee.IntegerField()
    tarifa_base = peewee.IntegerField()
    cantidad_total = peewee.IntegerField(null=True) # Opcional

    class Meta:
        table_name = 'tipos_habitacion'

class Habitacion(BaseModel):
    id = peewee.AutoField()
    numero = peewee.CharField(max_length=10, unique=True)
    tipo = peewee.ForeignKeyField(TipoHabitacion, backref='habitaciones', on_delete='CASCADE')
    estado = peewee.CharField(max_length=20, default='Activa') # Ej: Activa, Mantenimiento

    class Meta:
        table_name = 'habitaciones'

class Reserva(BaseModel):
    id = peewee.AutoField()
    cliente = peewee.ForeignKeyField(Cliente, backref='reservas', field=Cliente.dni, on_delete='CASCADE')
    habitacion = peewee.ForeignKeyField(Habitacion, backref='reservas_habitacion', on_delete='CASCADE')
    fecha_checkin = peewee.DateField()
    fecha_checkout = peewee.DateField()
    total_personas = peewee.IntegerField()
    costo_total = peewee.IntegerField(null=True) # Se calcula en el servicio
    estado_reserva = peewee.CharField(max_length=20, default='Confirmada') # Ej: Confirmada, Cancelada

    class Meta:
        table_name = 'reservas'