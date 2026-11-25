# Turnero Digital — entregables

## Registro público de turnos
- [x] Vista móvil accesible mediante código QR para solicitar un turno.
- [x] Formulario en español que solicite nombre, apellido y número de cédula.
- [x] Selección obligatoria entre programación de clases prácticas de moto, programación de clases prácticas de carro, programación o asistencia a examen teórico, certificación, solicitar horarios, enrolamiento y atención al usuario. Si una persona necesita moto y carro, debe tomar un turno independiente para cada uno.
- [x] Horario en hora de Colombia: durante almuerzo se reciben turnos de carro de 12:00 a 13:00 y de moto de 13:00 a 14:00, informando que la atención se reanuda a las 14:00; los cierres del final de día conservan el límite de 20 minutos antes (carro 15:40, moto 14:40 y atención general 15:10).
- [x] Cuando ya pasó la hora límite, el usuario recibe una explicación clara de que la atención termina después y que el turno debe tomarse 20 minutos antes para alcanzar a ser atendido, incluyendo la última hora válida.
- [x] Validación de campos obligatorios y confirmación con número de turno y resumen de la solicitud.

## Cola y persistencia
- [x] La información de cada turno se conserva en la base de datos con posición, estado e historial operativo.
- [x] La cola se ordena por llegada y refleja estados de espera, llamado, atención, finalizado y omitido.
- [x] La vista pública puede consultar su número de turno y el turno que está siendo atendido.

## Operación 1 a 1
- [x] El panel de operador solicita contraseña y protege en el servidor las acciones de llamar, atender, omitir y finalizar mediante una sesión temporal.
- [x] El acceso permite elegir entre Yury y Jonathan: Yury gestiona Programación moto y servicios generales; Jonathan gestiona Programación carro y servicios generales.
- [x] Yury y Jonathan pueden ver y gestionar por separado Programación o asistencia a examen teórico y Certificación; cada uno mantiene bloqueado el servicio de vehículo asignado al otro.
- [x] Los turnos históricos que tenían la opción combinada Agendar examen teórico y certificación fueron migrados a Certificación conservando sus datos, número y estado.
- [x] Cada turno pendiente incluye un menú de tres puntos con acciones protegidas para marcarlo como atendido o no atendido.
- [x] Al marcar atendido o no atendido un turno desde la cola o desde la atención en curso, desaparece de inmediato de la cola y del turno actual, y pasa al historial sin que una respuesta antigua lo restaure.
- [x] Las sesiones de Yury y Jonathan usan tokens firmados con duración de 12 horas para sobrevivir reinicios del servidor; si una sesión no es válida, el panel muestra el error y solicita ingresar nuevamente en lugar de fallar silenciosamente.
- [x] Vista de operador con turno actual, cola pendiente, métricas y filtros por servicio.
- [x] Llamado individual del siguiente turno respetando el orden de llegada.
- [x] Acciones para llamar/repetir llamado, marcar en atención, omitir y finalizar el turno actual.
- [x] Actualización automática de la cola entre la vista pública y la vista de operador.

## Presentación
- [x] Interfaz completamente en español, adaptable a teléfono, tableta y escritorio.
- [x] Acceso directo al modo operador y QR imprimible desde la pantalla principal.
