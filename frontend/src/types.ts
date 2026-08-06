export interface User {
  id: number;
  username: string;
  email: string | null;
  full_name: string | null;
  role: 'manager' | 'driver';
}

export interface Vehicle {
  id: number;
  vehicle_number: string;
  registration: string | null;
  type: string;
  capacity: number;
  health: number;
  fuel: number;
  mileage: number;
  insurance: string | null;
  pollution: string | null;
  fitness: string | null;
  gps: string;
  latitude: number;
  longitude: number;
  speed: number;
  availability: 'Available' | 'On Duty' | 'Maintenance';
  current_trip_id: number | null;
}

export interface Driver {
  id: number;
  user_id: number | null;
  name: string;
  photo: string | null;
  license: string | null;
  license_expiry: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  experience: number;
  availability: 'Available' | 'On Duty' | 'Off Duty';
  working_hours: number;
  rating: number;
  violations: number;
  health: string;
  performance: number;
  vehicle_id: number | null;
}

export interface Stop {
  location: string;
  type: 'Pickup' | 'Delivery' | 'Inspection' | 'Fuel Stop';
  status: 'Pending' | 'Completed';
}

export interface TripHistory {
  status: string;
  timestamp: string;
  notes: string;
}

export interface Trip {
  id: number;
  customer: string;
  pickup: string;
  destination: string;
  stops: string | null; // JSON parsed on frontend
  cargo_type: string | null;
  weight: number;
  volume: number;
  vehicle_type: string | null;
  required_capacity: number;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  status: 'Unassigned' | 'Assigned' | 'Loading' | 'In Transit' | 'Delivered' | 'Problem' | 'Completed';
  pickup_date: string | null;
  delivery_date: string | null;
  instructions: string | null;
  fragile: boolean;
  temperature_control: boolean;
  insurance: boolean;
  driver_id: number | null;
  vehicle_id: number | null;
  eta: string | null;
  fuel_cost: number;
  revenue: number;
  distance: number;
  remaining_distance: number;
  route_coordinates: string | null; // JSON parsed
  documents: string | null; // JSON parsed
  history: string | null; // JSON parsed
  notes: string | null;
  shortest_route_meta?: string | null;
  fastest_route_meta?: string | null;
  assignment_reason?: string | null;
  assignment_confidence?: number | null;
  assignment_time?: string | null;
}

export interface Warehouse {
  id: number;
  name: string;
  location: string;
  capacity: number;
  occupancy: number;
  inbound: number;
  outbound: number;
  inventory: string | null; // JSON parsed
  dock_appointments: string | null; // JSON parsed
}

export interface ProofOfDelivery {
  id: number;
  trip_id: number;
  signature_path: string | null;
  photo_path: string | null;
  pdf_path: string | null;
  barcode: string | null;
  qr_code: string | null;
  status: 'Pending' | 'Approved' | 'Rejected';
  submitted_at: string;
}

export interface Invoice {
  id: number;
  invoice_number: string;
  trip_id: number;
  customer: string;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  status: 'Pending' | 'Paid' | 'Overdue';
  created_at: string;
}

export interface Alert {
  id: number;
  severity: 'Critical' | 'High' | 'Medium' | 'Low' | 'Resolved';
  title: string;
  description: string | null;
  vehicle_number: string | null;
  driver_name: string | null;
  location: string | null;
  timestamp: string;
  resolved: boolean;
  trip_id: number | null;
}

export interface AutomationLog {
  id: number;
  timestamp: string;
  trigger_event: string;
  pipeline_step: string;
  status: string;
  details: string | null;
}
