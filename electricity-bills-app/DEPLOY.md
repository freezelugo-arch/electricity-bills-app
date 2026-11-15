# Publicación paso a paso

## 1. Supabase
- Crear proyecto con región UE.
- Ejecutar `supabase/schema.sql`.
- Copiar Project URL y publishable/anon key.
- Crear usuario personal en Authentication.
- Deshabilitar nuevos registros públicos después de crear tu cuenta.
- En Storage comprobar que `electricity-bills` es privado.

## 2. OpenAI
- Crear una API key en la plataforma de OpenAI.
- Añadirla únicamente como `OPENAI_API_KEY` en el entorno servidor.
- El modelo predeterminado es `gpt-4.1`, configurable con `OPENAI_MODEL`.

## 3. Vercel
- Importar el repositorio desde GitHub.
- Framework: Next.js.
- Añadir `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `OPENAI_API_KEY`, `OPENAI_MODEL`.
- Deploy.
- En Supabase Auth configurar Site URL y Redirect URLs con la dirección `*.vercel.app` asignada.

## 4. Primera prueba
- Entrar en `/register` para crear la cuenta personal.
- Iniciar sesión y subir una copia de prueba de una factura.
- Comparar extracción contra el PDF original antes de guardar.
- Confirmar que el PDF se abre mediante enlace firmado y que otro usuario no puede leerlo.
