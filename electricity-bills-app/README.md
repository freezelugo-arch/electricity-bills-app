# Mis facturas de electricidad

Aplicación privada Next.js + Supabase + OpenAI para registrar facturas eléctricas PDF.

## Incluye
- Dashboard y navegación responsive.
- Login y registro con Supabase Auth.
- Carga múltiple de PDF, extracción asistida por OpenAI Responses API y revisión manual antes de guardar.
- Almacenamiento privado de originales con enlaces firmados temporales.
- PostgreSQL con RLS por usuario y precisión decimal.
- Histórico, estadísticas mensuales y comparador inicial.

## Requisitos
- Node.js 20.9 o superior.
- Proyecto Supabase.
- Clave de OpenAI API.
- Cuenta Vercel para publicar.

## Configuración
1. Crea un proyecto en Supabase, preferiblemente en una región de la UE (por ejemplo Frankfurt si está disponible).
2. En SQL Editor ejecuta el archivo `supabase/schema.sql` completo.
3. En Authentication > Providers habilita Email. Para uso personal, desactiva los registros públicos una vez creada tu cuenta (o crea el usuario desde el panel de Supabase). Configura la URL de redirección y confirmación de correo para tu dominio Vercel.
4. Copia `.env.example` a `.env.local` y rellena URL Supabase, publishable/anon key y clave OpenAI. Nunca pongas `OPENAI_API_KEY` en una variable `NEXT_PUBLIC_*` ni la subas a Git.
5. Ejecuta:

```bash
npm install
npm run dev
```

6. Abre `http://localhost:3000`.
7. Para publicar, sube el proyecto a un repositorio privado de GitHub, impórtalo desde Vercel y configura las mismas variables de entorno en Project Settings > Environment Variables. Haz un nuevo deploy después de guardar variables.

## Importante antes de producción
- La extracción usa `gpt-4.1` por defecto y envía el PDF a OpenAI para análisis visual/textual. Revisa el coste y las políticas de tratamiento de datos de OpenAI antes de cargar documentos personales.
- La ruta limita el PDF a 20 MB. Ajustar si se cambia la infraestructura.
- La tabla evita duplicados por `user_id + invoice_number`. Si el número no existe, hay que implementar una huella SHA-256 del documento antes de permitir duplicados sin número.
- El dashboard agrupa facturas por fecha de emisión; no prorratea periodos de facturación que cruzan meses. Para estadísticas energéticas rigurosas se debe distribuir por días o lecturas del periodo.
- El promedio de precio de energía usa coste de energía / kWh; no es el precio final de factura dividido por kWh. Son métricas diferentes.
- Se recomienda habilitar MFA, copias de seguridad, límites de tamaño, rate limiting en la API y monitorización antes de producción.
- El formulario inicial permite revisar campos principales; los periodos horarios se muestran para comprobación y se almacenan en JSONB. Añadir editor de detalle por periodo y pantalla de edición/eliminación lógica como siguiente iteración.
