import unittest

from app.models import User, Vehicle, Driver, Trip
from app.database import Base, SessionLocal
from sqlalchemy import create_engine


class ManagerScopeTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite:///:memory:')
        Base.metadata.create_all(bind=self.engine)
        self.session = SessionLocal()
        self.session.bind = self.engine

        self.manager_a = User(username='manager_a', hashed_password='x', role='manager')
        self.manager_b = User(username='manager_b', hashed_password='x', role='manager')
        self.session.add_all([self.manager_a, self.manager_b])
        self.session.commit()

        self.vehicle_a = Vehicle(vehicle_number='TRK-A1', type='Box Truck', capacity=5.0, manager_id=self.manager_a.id)
        self.vehicle_b = Vehicle(vehicle_number='TRK-B1', type='Box Truck', capacity=5.0, manager_id=self.manager_b.id)
        self.session.add_all([self.vehicle_a, self.vehicle_b])
        self.session.commit()

        self.driver_a = Driver(name='Driver A', vehicle_id=self.vehicle_a.id, manager_id=self.manager_a.id)
        self.driver_b = Driver(name='Driver B', vehicle_id=self.vehicle_b.id, manager_id=self.manager_b.id)
        self.session.add_all([self.driver_a, self.driver_b])
        self.session.commit()

        self.trip_a = Trip(customer='Customer A', pickup='A', destination='B', driver_id=self.driver_a.id, vehicle_id=self.vehicle_a.id, manager_id=self.manager_a.id)
        self.trip_b = Trip(customer='Customer B', pickup='C', destination='D', driver_id=self.driver_b.id, vehicle_id=self.vehicle_b.id, manager_id=self.manager_b.id)
        self.session.add_all([self.trip_a, self.trip_b])
        self.session.commit()

    def tearDown(self):
        self.session.close()
        Base.metadata.drop_all(bind=self.engine)

    def test_manager_specific_data_isolated(self):
        manager_a_trips = self.session.query(Trip).filter(Trip.manager_id == self.manager_a.id).all()
        manager_a_vehicles = self.session.query(Vehicle).filter(Vehicle.manager_id == self.manager_a.id).all()
        manager_a_drivers = self.session.query(Driver).filter(Driver.manager_id == self.manager_a.id).all()

        self.assertEqual(len(manager_a_trips), 1)
        self.assertEqual(manager_a_trips[0].customer, 'Customer A')
        self.assertEqual(len(manager_a_vehicles), 1)
        self.assertEqual(manager_a_vehicles[0].vehicle_number, 'TRK-A1')
        self.assertEqual(len(manager_a_drivers), 1)
        self.assertEqual(manager_a_drivers[0].name, 'Driver A')


if __name__ == '__main__':
    unittest.main()
