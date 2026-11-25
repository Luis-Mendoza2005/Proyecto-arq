# Bitácora del proyecto

## Dia 1 - Preparación teorica y definicion del esquema de base de datos.
- Fecha: 23 de noviembre de 2026.
- Archivos modificados: 001_create_schema.sql, 001_seed_vehicles.sql
- Pruebas ejecutadas: No aplica.
- Resultado: Se estableció la base del proyecto, teniendo en cuenta los casos de uso y restricciones.
- Pendientes: Continuar modificando la plantilla, escribir openapi.yaml con los datos cambiados.

El día de hoy, el trabajo consistió en revisar los documentos previamente escritos sobre el proyecto, especificamente el criterio 1 parte 1,
donde se definieron los drivers del proyecto, los casos de uso, y las restricciones.
En este caso, se pueden identificar 3 casos de uso principales sobre los que se va a trabajar (CU-01, CU-02, CU-03), junto con las restricciones del proyecto que son relevantes para esta etapa (R-01, R-03).
En terminos prácticos, el CU-01 (Registrar un alquiler) se implementa on una operación POST a /api/rentas, el CU-02 (Consultar un alquiler) se implementa con una operacion
GET a /api/rentals | /api/rentals/{id}, y el CU-03 (Suspender un alquiler) se implementa también con una operación POST /api/rentals/{id}/suspension.
De esa manera, el alcance de esta versión se limita a cubrir esos tres casos de uso principales, acatandose a la restriccion técnica del negocio; se omiten los escenarios
de calidad, ya que estos se encuentran fuera del alcance de este criterio, y se registran como pendientes. 
Asi mismo, se deben responder una serie de preguntas de diseño en esta etapa temprana de desarrollo, para facilitar las futuras implementaciones, por ejemplo
¿Como se sabe que un vehiculo esta disponible? En este caso, se va a usar el estado del vehiculo. Esto debido a que es la manera más barata de consultar disponibilidad.
¿Que significa que un alquiler este finalizado? Que la fecha del fin del alquiler esta pasada, por lo que es un estado derivado. Esto debido a que evita guardar un dato
adicional que se desactualizaría. Esto solo aplica a alquileres que no fueron suspendidos.
¿Que se guarda de los documentos? No se guarda el archivo entero, sino que una referencia de texto.
¿Debería ser un error una consulta sin datos? En vez de devolver un error, va a devolver un codigo HTTP 200 con una lista vacia. Sin embargo, un id inexistente sí retorna un 
codigo 404.

Adicionalmente, se definió el esquema de la base de datos y se creó un archivo semilla con entradas estaticas de prueba. Los detalles de la implementación y razones de por qué se hace cada cosa estan en los comentarios del archivo.

## Dia 2 - Implementación de servicios solicitados.
- Fecha: 24 de noviembre de 2026.
- Archivos modificados: /application/ConsultRentalService.js, /application/ListVehiclesService.js, /application/errors.js, /application/RegisterRentalService.js, /application/validation.js, /domain/rental.js, /domain/vehicle.js, /persistance/PostgresRentalRepository.js, /persistance/PostgresVehicleRepository.js
- Pruebas ejecutadas: No aplica.
- Resultado: Se hizo la mayor parte del trabajo..
- Pendientes: Realizar las pruebas solicitadas, terminar el contrato OpenAPI.

Se implementó, servicio por servicio, los servicios requeridos para cumplir con los casos de uso del programa. 

## Dia 3 - Finalización de prototipo.
- Fecha: 25 de noviembre de 2026.
- Archivos modificados: /tests, openapi.yaml
- Pruebas ejecutadas: 81.
- Resultado: Se finalizó y probó el prototipo.
- Pendientes: Realizar la presentación.

Se realizaron las pruebas del correcto funcionamiento de la api usando postman, y se comprobaron los codigos de error correspondientes a cada flujo alternativo.