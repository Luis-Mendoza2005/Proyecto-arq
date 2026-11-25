# Sistema de gestión de alquiler de carros — Arquitectura de Software (RdA 1, Criterio 2)

Monolito en capas (presentación → aplicación → persistencia) para el proyecto integrador
«Sistema de gestión de alquileres». Implementa los casos de uso primarios definidos en el
Criterio 1 y las restricciones que los gobiernan.

| Driver | Qué hace | Operación HTTP |
|---|---|---|
| CU-01 | Registrar un alquiler (cliente, vehículo, documentos). Si el vehículo no está disponible, se cancela el registro. | `POST /api/rentals` |
| CU-02 | Consultar alquileres con filtros (estado, cliente, vehículo, fechas), orden (fecha, nombre, duración) y paginación; o uno por id. | `GET /api/rentals`, `GET /api/rentals/{id}` |
| CU-03 | Suspender un alquiler en curso con su razón. Si ya finalizó, se informa con un conflicto. | `POST /api/rentals/{id}/suspension` |
| R-01 | JavaScript (Node.js + Express) con PostgreSQL. | — |
| R-03 | No se permiten alquileres con documentos faltantes (cédula/pasaporte, licencia y contrato firmado). | Validado en `POST /api/rentals` → `400` |
| Alcance | Gestión de vehículos (apoyo a CU-01). | `POST /api/vehicles`, `GET /api/vehicles` |

Además: `GET /health` y `GET /openapi.yaml` (publica el contrato de `docs/openapi.yaml`).

## Estructura por capas

```text
src/
├── presentation/   rutas y controladores HTTP (traducen errores a códigos de estado)
├── application/    casos de uso y reglas: validación, R-03, disponibilidad, estados
├── persistence/    SQL parametrizado, transacciones y conversión de filas
├── domain/         modelo documentado con JSDoc y constantes (estados, documentos)
├── app.js          composición de las capas y middleware Express
└── server.js       configuración del servidor y del pool de PostgreSQL
db/init/            esquema y datos de ejemplo (se cargan al crear el contenedor)
docs/               openapi.yaml y bitacora.md
tests/              pruebas automatizadas (Vitest)
```

Dependencias descendentes: la presentación solo conoce a la aplicación; la aplicación solo
conoce a la persistencia a través de los métodos de los repositorios; el SQL vive únicamente
en `src/persistence/`. Las reglas (R-03, disponibilidad, «ya finalizó») están en la capa de
aplicación; la persistencia añade condiciones en el SQL (`WHERE status = 'available'`, etc.)
solo para que el resultado sea correcto cuando dos solicitudes llegan a la vez.

## Requisitos

- Node.js 20 o superior y npm (probado con Node 22).
- Docker Desktop con Docker Compose, para PostgreSQL. Para las pruebas automatizadas **no** hace falta.
- Git.

## Instalar y ejecutar

En PowerShell, desde la raíz del repositorio:

```powershell
Copy-Item .env.example .env
npm ci
docker compose up -d db
npm run dev
```

La API queda en `http://localhost:3000`. PostgreSQL crea las tablas y tres vehículos de
ejemplo desde `db/init/`. Esos scripts solo se ejecutan la primera vez que se crea el volumen;
para reiniciar desde cero: `docker compose down -v` y luego `docker compose up -d db`.
El archivo `.env` es local y está excluido de Git. Para detener la base de datos:

```powershell
docker compose down
```

## Probar los flujos manualmente

Vehículos de ejemplo: `11111111-1111-4111-8111-111111111111` (Spark GT),
`22222222-2222-4222-8222-222222222222` (Rio) y `33333333-3333-4333-8333-333333333333` (Hilux).

**CU-01 — Registrar un alquiler** (responde `201`):

```powershell
$body = @{
  customerName = "Luis Mendoza"
  customerIdNumber = "0912345678"
  customerPhone = "+593991234567"
  vehicleId = "11111111-1111-4111-8111-111111111111"
  startsAt = "2026-11-25T09:00:00-05:00"
  endsAt = "2026-11-28T09:00:00-05:00"
  documents = @{
    identityDocument = "docs/luis-mendoza-cedula.pdf"
    driverLicense = "docs/luis-mendoza-licencia.pdf"
    signedContract = "docs/contrato-0001.pdf"
  }
} | ConvertTo-Json -Depth 3

$rental = Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/rentals `
  -ContentType "application/json" -Body $body
$rental.data.id
```

Repetir el mismo comando responde `409` (el vehículo ya está alquilado). Quitar
`signedContract` (o cualquier documento) responde `400` por la regla R-03.

**CU-02 — Consultar**:

```powershell
Invoke-RestMethod "http://localhost:3000/api/rentals?customerName=ana&status=active&sortBy=duration&order=asc"
Invoke-RestMethod "http://localhost:3000/api/rentals/$($rental.data.id)"
```

Sin coincidencias, la lista responde `200` con `data: []` y `meta.count: 0`; un id que no
existe responde `404`.

**CU-03 — Suspender**:

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/rentals/$($rental.data.id)/suspension" `
  -ContentType "application/json" -Body (@{ reason = "Avería del vehículo" } | ConvertTo-Json)
```

Responde `200` con el alquiler en estado `suspended` y libera el vehículo. Suspender un
alquiler ya suspendido o finalizado responde `409`.

## Contrato OpenAPI

El contrato está en `docs/openapi.yaml` (OpenAPI 3.0.3) y se publica en
`http://localhost:3000/openapi.yaml`. Para verlo de forma visual, impórtalo en Swagger Editor.
La prueba `tests/OpenApiContract.test.js` comprueba que cada operación implementada está
documentada, que cada código de estado probado figura en el contrato y que las respuestas
contienen los campos obligatorios del esquema.

## Ejecutar las pruebas automatizadas

```powershell
npm test
```

Vitest ejecuta las pruebas, sin necesidad de PostgreSQL (el `Pool` se simula):

| Archivo | Qué comprueba |
|---|---|
| `RegisterRentalService.test.js` | CU-01: éxito, R-03 por cada documento, fechas, formato de datos, vehículo inexistente/no disponible. |
| `ConsultRentalsService.test.js` | CU-02: valores por defecto, filtros válidos e inválidos, id inexistente. |
| `SuspendRentalService.test.js` | CU-03: éxito, razón inválida, alquiler finalizado, ya suspendido, conflicto de estado. |
| `RegisterVehicleService.test.js` | Registro y listado de vehículos, placa duplicada. |
| `PostgresRentalRepository.test.js`, `PostgresVehicleRepository.test.js` | SQL parametrizado, lista blanca de orden, transacciones (COMMIT/ROLLBACK). |
| `RentalApi.test.js`, `VehicleApi.test.js` | Flujos de principio a fin por HTTP: 200/201/400/404/409/500. |

