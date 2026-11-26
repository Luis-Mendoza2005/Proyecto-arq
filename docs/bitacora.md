# Bitácora de incrementos y cambios

- **Proyecto:** Sistema de gestión de alquileres (alquiler de carros)
- **Asignatura:** Arquitectura de Software — RdA 1, Criterio 2
- **Integrantes:** Luis David Mendoza López [completar integrantes adicionales, si aplica]
- **Repositorio:** https://github.com/Luis-Mendoza2005/Proyecto-arq.git
- **Versión evaluada:** rama `main`, commit [completar con el hash o la etiqueta de la entrega]

**Drivers de referencia (Criterio 1):**
CU-01 registrar un alquiler · CU-02 consultar un alquiler · CU-03 suspender un alquiler ·
R-01 JavaScript con PostgreSQL · R-03 no se permiten alquileres con documentos faltantes.

## Resumen de incrementos

| Día | Fecha | Driver o flujo atendido | Resultado |
|---|---|---|---|
| 1 | 23/11/2026 | CU-01, CU-02, CU-03; R-01, R-03 | Alcance y decisiones de diseño definidos; esquema de base de datos y datos semilla |
| 2 | 24/11/2026 | CU-01, CU-02, CU-03; R-03 | Servicios de aplicación, validación, errores y repositorios implementados |
| 3 | 25/11/2026 | CU-01, CU-02, CU-03; contrato de API | Pruebas automatizadas, contrato OpenAPI y verificación con Postman |

---

## Día 1 — Preparación teórica y definición del esquema de base de datos

- **Fecha:** 23 de noviembre de 2026.
- **Driver o flujo atendido:** CU-01, CU-02 y CU-03 (definición de operaciones); R-01 (PostgreSQL) y R-03 (documentos obligatorios).
- **Archivos o componentes modificados:** `001_create_schema.sql`, `001_seed_vehicles.sql`.
- **Pruebas ejecutadas:** no aplica (solo análisis y diseño).
- **Resultado:** quedaron definidos el alcance, las operaciones HTTP de cada caso de uso, las decisiones de diseño y el esquema de la base de datos con sus datos semilla.
- **Pendientes:** implementar los servicios, los repositorios y la capa de presentación; escribir `openapi.yaml` con los datos definidos.

### Actividad realizada

Se revisaron los documentos del Criterio 1 (Parte 1), donde se definieron los drivers, los
casos de uso y las restricciones. Se identificaron tres casos de uso principales y las
restricciones relevantes para esta etapa (R-01 y R-03).

| Caso de uso | Operación HTTP prevista |
|---|---|
| CU-01 Registrar un alquiler | `POST /api/rentals` |
| CU-02 Consultar un alquiler | `GET /api/rentals` y `GET /api/rentals/{id}` |
| CU-03 Suspender un alquiler | `POST /api/rentals/{id}/suspension` |

El alcance de esta versión se limita a esos tres casos de uso, respetando la restricción
técnica R-01 (JavaScript y PostgreSQL). Los escenarios de calidad quedan fuera del alcance de
este criterio y se registran como pendientes.

### Decisiones de diseño

| Pregunta | Decisión | Motivo |
|---|---|---|
| ¿Cómo se sabe que un vehículo está disponible? | Por el estado del vehículo. | Es la manera más barata de consultar la disponibilidad. |
| ¿Qué significa que un alquiler esté finalizado? | Que su fecha de fin ya pasó; es un estado derivado. Solo aplica a alquileres que no fueron suspendidos. | Evita guardar un dato adicional que se desactualizaría. |
| ¿Qué se guarda de los documentos? | Una referencia de texto, no el archivo. | Evita decidir el almacenamiento de archivos, que no es parte de este criterio. |
| ¿Una consulta sin datos es un error? | No: responde `200` con una lista vacía. Un id inexistente sí responde `404`. | Una búsqueda sin resultados no es un fallo; un recurso concreto que no existe sí lo es. |

Además, se definió el esquema de la base de datos y se creó un archivo semilla con entradas
estáticas de prueba. Los detalles y las razones de cada decisión están en los comentarios de
los archivos SQL.

---

## Día 2 — Implementación de los servicios solicitados

- **Fecha:** 24 de noviembre de 2026.
- **Driver o flujo atendido:** CU-01 (registrar), CU-02 (consultar) y CU-03 (suspender); R-03 (validación de documentos).
- **Archivos o componentes modificados:**
  - Aplicación: `src/application/ConsultRentalService.js`, `ListVehiclesService.js`, `RegisterRentalService.js`, `errors.js`, `validation.js`.
  - Dominio: `src/domain/rental.js`, `vehicle.js`.
  - Persistencia: `src/persistence/PostgresRentalRepository.js`, `PostgresVehicleRepository.js`.
  - [completar: `SuspendRentalService.js`, controladores, rutas y `app.js`, si se hicieron este día].
- **Pruebas ejecutadas:** no aplica (las pruebas se realizaron el día 3).
- **Resultado:** se implementaron los servicios de aplicación requeridos por los casos de uso, con su validación de entrada, los errores de negocio, el modelo de dominio y los repositorios de PostgreSQL.
- **Pendientes:** realizar las pruebas automatizadas, terminar el contrato OpenAPI y verificar cada flujo con Postman.

### Actividad realizada

Se implementó, servicio por servicio, lo necesario para cumplir los casos de uso. La
validación de entrada y la regla R-03 (no se permiten alquileres con documentos faltantes) se
ubicaron en la capa de aplicación, y el acceso a PostgreSQL en la capa de persistencia.

---

## Día 3 — Finalización del prototipo

- **Fecha:** 25 de noviembre de 2026.
- **Driver o flujo atendido:** CU-01, CU-02 y CU-03 (verificación de éxito y de flujos alternos); contrato de API.
- **Archivos o componentes modificados:** `tests/`, `docs/openapi.yaml`.
- **Pruebas ejecutadas:**
  - Automatizadas: `npm test` (Vitest), 81 pruebas.
  - Manuales: verificación de cada flujo con Postman, incluidos los códigos de error de los flujos alternos (`400`, `404`, `409`).
- **Resultado:** el prototipo quedó finalizado y probado; el contrato OpenAPI describe las operaciones implementadas.
- **Pendientes:** los de la sección siguiente.

### Actividad realizada

Se probó el funcionamiento de la API con pruebas automatizadas y con Postman, y se comprobaron
los códigos de respuesta de cada flujo alterno (vehículo no disponible, documentos faltantes,
recurso inexistente, alquiler finalizado o ya suspendido).

---

## Trazabilidad con los drivers

| Driver | Qué se implementó | Incrementos | Pruebas |
|---|---|---|---|
| CU-01 | `POST /api/rentals` | Día 1 (definición), Día 2 (implementación), Día 3 (pruebas) | Pruebas automatizadas y Postman |
| CU-02 | `GET /api/rentals`, `GET /api/rentals/{id}` | Día 1, Día 2, Día 3 | Pruebas automatizadas y Postman |
| CU-03 | `POST /api/rentals/{id}/suspension` | Día 1, Día 2, Día 3 | Pruebas automatizadas y Postman |
| R-01 | JavaScript con PostgreSQL | Día 1 (esquema), Día 2 (repositorios) | — |
| R-03 | Validación de documentos obligatorios | Día 1 (decisión), Día 2 (validación) | Pruebas automatizadas |
| Contrato | `docs/openapi.yaml` | Día 3 | Postman |

## Pendientes generales (fuera del alcance de este criterio)

- **QA-01 y QA-05 (desempeño):** pruebas de carga y medición del p95.
- **QA-02 (seguridad):** autenticación y cifrado de datos personales.
- **QA-03 y QA-04 (disponibilidad):** recuperación automática ante caídas del servidor.
- **Disponibilidad por fechas:** al controlarse solo por el estado del vehículo, no se detectan alquileres con fechas superpuestas.
- **Exportación (CU-02) y notificación al cliente (CU-03):** no implementadas; hoy los flujos alternos se informan mediante la respuesta de la API.
