--datos de prueba para los vehiculos
INSERT INTO vehicles (id, plate, brand, model, year) VALUES
  ('11111111-1111-4111-8111-111111111111', 'PBA-1234', 'Chevrolet', 'Spark GT', 2021),
  ('22222222-2222-4222-8222-222222222222', 'PCD-5678', 'Kia', 'Rio', 2022),
  ('33333333-3333-4333-8333-333333333333', 'GSA-9012', 'Toyota', 'Hilux', 2020)
/*Si se detectan dos ids iguales, no debe hacer nada y no debe devolver error, esto debido a que son datos de prueba y se va a estar levantando 
el docker constantemente durante el desarrollo. No se llena la tabla de alquileres, ya que esta se va a llenar dinamicamente con el funcionamiento del 
proyecto*/
ON CONFLICT (id) DO NOTHING;
