from peewee import *


db = SqliteDatabase('hotel.db')

class BaseModel(Model):
    class Meta:
        database = db
