# Acuerdo de Socios — VEXA

Sep 29, 2026 · @Jhony Rivera

Este acuerdo fija cómo trabajan, deciden y se reparten VEXA sus cuatro socios mientras no exista una empresa constituida. Es un borrador para discutir y ajustar entre todos antes de firmar; los campos entre \[corchetes\] se completan en la reunión de aprobación.

> No es asesoría legal. Puede firmarse como documento privado entre las partes (opcional: legalizar firmas en notaría). Si más adelante constituyen una SAC, su contenido se traslada al estatuto o a un pacto de socios formal.

## 1. Partes y objeto

Los socios de VEXA son Jhony Rivera, Rober Vasquez, José Gónzales y Diego Choque. VEXA desarrolla software a medida, páginas web y productos propios (Fivuza y Vantage).

El objetivo de este acuerdo es que cada socio tenga claro qué aporta, qué recibe a cambio y qué pasa si no cumple.

## 2. Roles y responsabilidades

Todos desarrollan (full stack, con apoyo de IA), pero cada socio es además responsable de un área: decide en ella y rinde cuentas en la reunión semanal. Como el desarrollo con IA es la parte más cubierta, las áreas sin dueño (comercial, diseño, gestión) son las que más importan hoy.

| Socio | Área | Responsabilidades | Horas del área (mínimo) |
| --- | --- | --- | --- |
| Rober | Líder técnico | Arquitectura, estándares, revisión de PRs (sobre todo código generado con IA), despliegues | 25 % de sus horas |
| Jhony | Gestión y finanzas | Sprints y reuniones, registro de horas en Vexa Studio, gastos, seguimiento de este acuerdo | 30 % de sus horas |
| José | Comercial | Prospectar clientes, propuestas y cotizaciones, seguimiento de contactos | 40 % de sus horas |
| Diego | Diseño y marketing | UI/UX de los proyectos, marca VEXA, portafolio web, redes | 40 % de sus horas |

Nadie tiene hoy experiencia en comercial, diseño ni gestión: se aprende haciendo. La asignación es una propuesta y se revisa cada 3 meses; cualquier socio puede pedir rotar de área.

## 3. Dedicación mínima y registro de horas

Cada socio se compromete con estas horas semanales y cumple al menos el 80 % en cada mes.

| Socio | Horas/semana | Mínimo mensual (80 %, 4 semanas) |
| --- | --- | --- |
| Rober | 20 | 64 h |
| Jhony | 15 | 48 h |
| José | 15 | 48 h |
| Diego | 25 | 80 h |

Reglas de registro:

- Cada socio registra sus horas en Vexa Studio como máximo cada domingo.
- Solo cuenta trabajo real para VEXA, vinculado a una tarea del tablero o a la reunión semanal.
- Las horas se validan en la revisión de cada sprint; si alguien objeta un registro, se aclara en esa reunión.
- En semanas de exámenes u otra carga justificada, el socio puede reducir su compromiso avisando con al menos 7 días. Ese periodo no cuenta como incumplimiento.
- El compromiso de horas puede cambiarse, pidiéndolo en la reunión semanal; rige desde el siguiente sprint.

## 4. Participación: equity dinámico

La participación de cada socio en VEXA es proporcional a lo que aporta de verdad, medido en puntos. No hay porcentajes fijos hasta el congelamiento.

| Aporte | Puntos |
| --- | --- |
| 1 hora de trabajo no pagada | 20 puntos (valor referencial S/ 20 por hora, igual para todos) |
| S/ 1 aportado en dinero para gastos de VEXA | 2 puntos |
| Hora ya pagada con dinero de VEXA o de un cliente | 0 puntos |

```latex
\text{Participación}_i = \frac{\text{Puntos}_i}{\sum \text{Puntos de todos los socios}}
```

- **Aportes previos** (desde marzo 2025 hasta la firma): no suman puntos. Por acuerdo mutuo, todos empiezan en cero desde la firma.
- **Congelamiento**: los puntos se convierten en porcentajes fijos en la primera de estas fechas: 12 meses desde la firma, el primer cliente que pague al menos S/ \[monto\], o la constitución de una empresa.
- Después del congelamiento, nuevos aportes se reconocen con sueldo, pago por proyecto o nuevo acuerdo, no con puntos.
- Cada socio tiene un voto, sin importar sus puntos, hasta el congelamiento.

## 5. Gastos y aportes de dinero

Todo gasto de VEXA (dominios, hosting, licencias, herramientas de IA compartidas, etc.) se registra en Vexa Studio con fecha, monto, concepto y comprobante.

- Gastos hasta S/ \[50\]: los decide el responsable de gestión y finanzas.
- Gastos mayores a S/ \[50\]: requieren aprobación de 3 de 4 socios.
- Los gastos ya realizados antes de la firma se registran al empezar, con el acuerdo de todos sobre montos y quién los pagó.
- Un gasto suma puntos (sección 4). Si después VEXA lo reembolsa, se restan esos puntos: no se cobra dos veces.
- Suscripciones personales de IA que cada uno ya usa no son gasto de VEXA, salvo acuerdo previo.

Gastos recurrentes conocidos:

| Concepto | Monto | Próxima renovación |
| --- | --- | --- |
| Dominio de VEXA (ya comprado; gasto previo, no suma puntos) | US$ 13 al año | Feb 23, 2027 |

## 6. Forma de trabajo

El trabajo se organiza en sprints de 2 semanas, con una sola reunión síncrona por semana; el resto es asíncrono.

| Práctica | Frecuencia | Detalle |
| --- | --- | --- |
| Reunión semanal | Se acuerda cada semana con anticipación, 45 min | Planificación o revisión del sprint, avance por área, decisiones pendientes. Asistencia obligatoria. |
| Daily escrito | Lunes, miércoles y viernes | En la plataforma interna: qué hice, qué haré, qué me bloquea. |
| Tablero de tareas | Continuo | Plataforma interna: cada tarea con responsable y estimación. |
| Registro de horas y gastos | Semanal (domingo) | Vexa Studio. |
| Revisión de código | Cada PR | Ningún PR entra a main sin revisión de otro socio. |

Prioridad del trabajo, en este orden: 1) plataforma interna de gestión de VEXA (MVP con plazo cerrado), 2) Fivuza. La búsqueda de clientes continúa en paralelo desde el área comercial. Vantage queda en pausa hasta nueva decisión.

## 7. Toma de decisiones

Cada socio tiene un voto. El tipo de decisión define cuántos votos hacen falta.

| Tipo | Ejemplos | Quién decide |
| --- | --- | --- |
| Operativa | Tareas del sprint, herramientas, detalles técnicos o de diseño | El responsable del área |
| Importante | Aceptar un cliente, precio de una propuesta, gasto mayor a S/ \[50\], pausar o priorizar un producto, sumar colaboradores | 3 de 4 socios |
| Crítica | Modificar este acuerdo, sumar un socio, constituir empresa, vender VEXA o un producto | Unanimidad |

En la salida o sanción de un socio, ese socio no vota. Las decisiones importantes y críticas quedan registradas en la plataforma interna (hasta que esté lista, en un acta simple).

## 8. Incumplimiento y salida de socios

Hay incumplimiento cuando, sin aviso previo, un socio:

- registra menos del 80 % de su mínimo en un mes,
- falta a 2 reuniones semanales seguidas, o
- no entrega las tareas que se comprometió a hacer en 2 sprints seguidos.

Consecuencias, de forma progresiva:

1. **Primera vez**: aviso por escrito y conversación para ajustar su compromiso.
2. **Segunda vez en 6 meses**: deja de sumar puntos por horas durante 1 mes.
3. **Tercera vez en 6 meses**: los demás socios pueden votar su salida.

Al salir un socio antes del congelamiento:

| Motivo de salida | Puntos por horas | Puntos por dinero |
| --- | --- | --- |
| Causa justificada (salud, fuerza mayor) | Conserva el 100 % | Conserva el 100 % |
| Salida voluntaria, con aviso de 30 días | Conserva el \[50\] % | Conserva el 100 % |
| Salida por incumplimiento | Conserva el \[25\] % | Conserva el 100 % |

Quien sale entrega accesos, credenciales y archivos de VEXA en un plazo de 7 días. Si lo prefiere, el dinero que aportó se le reembolsa cuando VEXA tenga ingresos, antes de repartir utilidades, y se restan esos puntos.

## 9. Propiedad intelectual y confidencialidad

Todo lo creado para VEXA (código, diseños, documentos, marca, dominios) pertenece a VEXA en conjunto, no al socio que lo hizo, incluido lo creado antes de la firma. Los proyectos personales fuera de VEXA siguen siendo de cada uno.

- Los repositorios, dominios y cuentas de VEXA están a nombre de una organización compartida (por ejemplo, la organización de GitHub), con al menos 2 socios como administradores.
- Datos de clientes, credenciales y código privado no se comparten fuera de VEXA.
- No se pegan credenciales, claves de API ni datos personales de clientes en herramientas de IA.
- La confidencialidad sigue vigente después de que un socio salga.

## 10. Incorporación de colaboradores

Los colaboradores (freelancers, practicantes o ex socios) trabajan en VEXA sin ser socios ni sumar puntos.

- Se incorporan con aprobación de 3 de 4 socios.
- Se les paga por tarea o por un porcentaje del proyecto en que participan, acordado antes de empezar.
- Firman un compromiso de confidencialidad y de cesión a VEXA de lo que produzcan.
- Reciben solo los accesos que su tarea necesita, y se retiran al terminar.
- Un colaborador puede pasar a socio solo por unanimidad (decisión crítica).

## 11. Vigencia, revisión y firmas

Este acuerdo rige desde la firma. Se revisa cada 3 meses en la reunión semanal; cualquier cambio sigue la regla de decisión crítica (unanimidad).

| Socio | DNI | Firma | Fecha |
| --- | --- | --- | --- |
| Jhony Rivera |  |  |  |
| Rober Vasquez |  |  |  |
| José Gónzales |  |  |  |
| Diego Choque |  |  |  |
