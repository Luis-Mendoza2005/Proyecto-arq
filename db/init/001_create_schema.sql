-- Crear tabla para los vehiculos del emprendimiento
-- Al ser un emprendimiento pequeño, se asume una capacidad maxima de 5 vehiculos.
create table if not exists vehicles (
  id uuid primary key,
  plate varchar(10) not null unique,
  brand varchar(80) not null,
  model varchar(80) not null, 
  year smallint not null check (year between 1980 and 2100),
  status varchar(20) not null default 'available'
    check (status in ('available','rented','maintenance')), --Se comprueba que el estado este dentro de los 3 posibles.
  created_at timestamptz not null default now() 
);

/*Creación de tabla alquileres, con información de los clientes y de su alquiler. Debido al alcance del proyecto
y los casos de uso determinados, no se incluye una tabla a parte con la información del cliente, esto es una decision tomada en base
a las necesidades del emprendimiento y las restricciones del hardware.*/
create table if not exists rentals (
  id UUID primary key,
  vehicle_id uuid not null references vehicles (id), --Referencia a la tabla vehiculos.
  --Información del cliente se almacena directamente en la tabla rentals
  customer_name varchar(160) not null,
  customer_id_number varchar(20) not null,
  customer_phone varchar(20) not null,
  /*Los documentos del cliente se guardan como referencias al almacenamiento interno del servidor, para acotarse a la restricción
  de hardware establecida R-02, todos los documentos tienen que estar registrados para realizar un alquiler R-03*/  
  identity_document_ref varchar(255) not null,
  driver_license_ref varchar(255) not null,
  signed_contract_ref varchar(255) not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status varchar(20) not null default 'active'
    check (status in ('active', 'suspended')), --No se guarda un estado finalizado, en su lugar, se deriva de la fecha de termino (ends_at)
  --CU-03 (Suspender un alquiler)
  suspension_reason varchar(500),
  suspended_at timestamptz,
  created_at timestamptz not null default now(),
  constraint rentals_valid_time check (ends_at > starts_at), --Un alquiler solo tiene un tiempo valido si su fecha de fin es despues de su fecha de inicio
  constraint rentals_suspension_data check (
    (status = 'suspended' and suspension_reason is not null and suspended_at is not null) --Un alquiler solo puede estar suspendido si tiene una razon y una fecha de suspension
    or (status = 'active' and suspension_reason is null and suspended_at is null) --Un alquiler solo puede estar activo si no tiene datos de suspensión
  )
);

--Indices para las consultas historicas (QA-01)
CREATE INDEX IF NOT EXISTS rentals_starts_at_idx ON rentals (starts_at);
CREATE INDEX IF NOT EXISTS rentals_status_idx ON rentals (status);
CREATE INDEX IF NOT EXISTS rentals_vehicle_id_idx ON rentals (vehicle_id);
