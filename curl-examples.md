# Ejemplos de prueba con curl — API del Sistema 1

Cada comando asume el servidor corriendo en el puerto configurado.

```bash
# Arrancar el servidor (en otra terminal)
yarn start
```

El puerto sale de `.env` (`PORT`, ver `.env.example` → `3101`). Si no hay `.env`, `bin/www`
usa `3000`. Ajusta la variable:

```bash
BASE=http://localhost:3101
```

> Consejo: agrega `| jq` al final de cada comando para ver la respuesta formateada (si tienes `jq`).

---

## 1. Estado / raíz

```bash
curl -s $BASE/
# {"title":"API del Sistema 1","version":"1.0"}
```

---

## 2. Proveedores

Lista los proveedores configurados (sin credenciales). Usa uno de estos `supplier_id` en
`/v1/search`.

```bash
curl -s $BASE/v1/providers
```

> Con `endpoints.json.example` solo verás `EDOMEX`. El `endpoints.json` real trae ~29 proveedores.

---

## 3. Resumen — `POST /v1/summary`

Consulta a todos los proveedores (o a los que coincidan con el filtro). No recibe `supplier_id`;
se filtra por `nivel_gobierno` o por `institucion`.

**a) Sin filtros (todos los proveedores):**

```bash
curl -s -X POST $BASE/v1/summary \
  -H 'Content-Type: application/json' \
  -d '{}'
```

**b) Por nivel de gobierno** (debe coincidir exactamente con el `levels` del proveedor, p. ej. `estatal`):

```bash
curl -s -X POST $BASE/v1/summary \
  -H 'Content-Type: application/json' \
  -d '{"nivel_gobierno":"estatal"}'
```

**c) Por institución** (un proveedor concreto):

```bash
curl -s -X POST $BASE/v1/summary \
  -H 'Content-Type: application/json' \
  -d '{"institucion":{"nombre":"Secretaría Ejecutiva del Sistema Estatal Anticorrupción","supplier_id":"EDOMEX"}}'
```

**d) Por nombre:**

```bash
curl -s -X POST $BASE/v1/summary \
  -H 'Content-Type: application/json' \
  -d '{"nombres":"Juan","primerApellido":"Pérez","segundoApellido":"López"}'
```

---

## 4. Búsqueda — `POST /v1/search`

Requiere `supplier_id`. Opcional: `query`, `sort`, `page`, `pageSize` (por defecto `page: 1`,
`pageSize: 10`). Los filtros se reagrupan en `datosEmpleoCargoComision` / `bienesInmuebles` y los
rangos `Min` / `Max` se convierten en `{min, max}`.

**a) Mínimo:**

```bash
curl -s -X POST $BASE/v1/search \
  -H 'Content-Type: application/json' \
  -d '{"supplier_id":"EDOMEX"}'
```

**b) Query con parámetros simples:**

```bash
curl -s -X POST $BASE/v1/search \
  -H 'Content-Type: application/json' \
  -d '{"supplier_id":"EDOMEX","query":{"nombres":"Juan","primerApellido":"Pérez"}}'
```

**c) Query con datos de empleo/cargo:**

```bash
curl -s -X POST $BASE/v1/search \
  -H 'Content-Type: application/json' \
  -d '{"supplier_id":"EDOMEX","query":{"nombreEntePublico":"Secretaría de la Función Pública","entidadFederativa":"Zacatecas","nivelOrdenGobierno":"estatal"}}'
```

**d) Query con rangos** (`valorAdquisicion` va a `bienesInmuebles`; `totalIngresosNetos` queda arriba):

```bash
curl -s -X POST $BASE/v1/search \
  -H 'Content-Type: application/json' \
  -d '{"supplier_id":"EDOMEX","query":{"valorAdquisicionMin":"1000","valorAdquisicionMax":"50000","totalIngresosNetosMin":"0"}}'
```

**e) Orden y paginación:**

```bash
curl -s -X POST $BASE/v1/search \
  -H 'Content-Type: application/json' \
  -d '{"supplier_id":"EDOMEX","sort":{"nombres":"asc"},"page":1,"pageSize":25}'
```

**f) Todo junto:**

```bash
curl -s -X POST $BASE/v1/search \
  -H 'Content-Type: application/json' \
  -d '{
    "supplier_id": "EDOMEX",
    "query": {"nombres": "Juan", "entidadFederativa": "Zacatecas"},
    "sort": {"primerApellido": "desc"},
    "page": 2,
    "pageSize": 20
  }'
```

**Errores** (devuelven **500**, no 400):

```bash
# Falta supplier_id -> {"error":"Debe proporcionar un proveedor de información"}
curl -s -X POST $BASE/v1/search \
  -H 'Content-Type: application/json' \
  -d '{}'

# Proveedor inexistente -> {"error":"Proveedor de información no disponible"}
curl -s -X POST $BASE/v1/search \
  -H 'Content-Type: application/json' \
  -d '{"supplier_id":"NOEXISTE"}'
```

---

## 5. Logger — `POST /v1/logger`

Reenvía logs del frontend al log del servidor. Responde `{"msj":"ok"}`.

```bash
curl -s -X POST $BASE/v1/logger \
  -H 'Content-Type: application/json' \
  -d '{"logs":[{"level":"info","message":"prueba desde curl"},{"level":"error","message":"algo falló"}]}'
```

> No omitas `logs`: un body sin `logs` hoy lanza un `TypeError` no controlado y responde con la
> página HTML de error de Express (no JSON).

---

## Notas

- Cada request genera **una sola línea JSON** de access log en la salida del servidor (método, ruta,
  status, duración, IP, user-agent y, en `/v1/search`, `supplier` / `query` / `sort` / paginación).
- Los logs de la aplicación (log4js) también salen como JSON, un objeto por línea, con los datos
  separados en campos:
  `{"ts":...,"level":"ERROR","logger":"rest_data.js","supplier":"SESEA_QUERETARO","status":503,"statusText":"...","data":"..."}`.
- `endpoints.json` es local y está en `.gitignore`. Para resultados reales necesita credenciales
  válidas; con el archivo de ejemplo (`url`, `token_url` vacíos) `/v1/summary` y `/v1/search`
  devolverán entradas/errores de proveedor.
- `/v1/summary` y `/v1/search` llaman a APIs externas, así que pueden tardar.
