# Roadmap

## En curso: API pública de solo lectura
- [ ] Migración: tablas `api_keys`, `api_request_logs`, funciones SQL (`api_consume_key`, `api_list_references`, `api_inventory_stats`)
- [ ] Helper servidor `src/lib/publicApi.ts` (auth por llave, CORS, rate limit, logging, respuestas)
- [ ] Endpoints `/api/public/v1/*`: health, openapi.json, estado, referencias, referencias/:ref, skus/:sku, inventario
- [ ] Server functions admin para llaves (`src/lib/apiKeys.functions.ts`)
- [ ] Página `/integraciones`: gestión de llaves, documentación, consola de prueba
- [ ] Enlace desde `/cargar`
- [ ] Verificación end-to-end con curl / Playwright

## Pendiente
- [ ] Login para administración (`/cargar`, `/metricas`, `/integraciones`) — requiere decisión del usuario
