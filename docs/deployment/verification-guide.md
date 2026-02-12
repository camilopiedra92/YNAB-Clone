# Guía de Verificación de Despliegue (Coolify)

Esta guía te permite verificar matemáticamente si tu entorno de producción en Coolify está configurado correctamente, seguro y sincronizado con tu código.

## Opción A: Verificación Remota (Recomendada si tienes acceso SSH)

Si puedes conectarte por SSH a tu servidor y entrar al contenedor de la aplicación:

1.  **Entra a la consola de tu servidor** (vía SSH).
2.  **Entra al contenedor de la aplicación** (docker exec...).
3.  Ejecuta el script de verificación incorporado:

```bash
# Dentro del directorio de la app
npm run check:deploy
# Nota: Debes agregar este script al package.json primero, ver abajo
```

O simplemente usando `node` directo si ya tienes el archivo:

```bash
npx tsx scripts/verify-deployment.ts
```

## Opción B: Verificación Local (Contra Base de Datos de Producción)

Puedes ejecutar el script desde tu máquina local apuntando a la base de datos de producción.

1.  **Obtén la Connection String** de tu base de datos en Coolify.
    - Debe ser el formato: `postgres://usuario:password@ip-servidor:puerto/dbname`
2.  **Ejecuta el script localmente:**

```bash
DATABASE_URL="postgres://user:pass@host:5432/db" npx tsx scripts/verify-deployment.ts
```

## Interpretación de Resultados

El script verifica 4 pilares fundamentales:

### 1. Usuario y Privilegios

- **Ideal:** Usuario sin `BYPASSRLS` y sin `SUPERUSER`.
- **Común en Coolify:** Si ves `WARNING: Connected user has BYPASSRLS`, significa que estás usando el usuario `postgres` (admin). **La app funcionará bien**, pero la capa de seguridad RLS está desactivada para _este_ usuario. Tu código sigue protegiendo los datos, pero pierdes la defensa en profundidad.

### 2. Tablas Críticas con RLS

- Verifica que `accounts`, `budgets`, etc. tengan `RLS Enabled`.
- Si una dice `DISABLED`, tus migraciones no corrieron correctamente.

### 3. Políticas Activas

- Lista las reglas de seguridad reales que Postgres está aplicando.
- Debes ver políticas como `accounts_budget_isolation`, `budgets_user_isolation`.

### 4. Estado de Migraciones

- Confirma que la tabla de control de Drizzle existe.

## Paso a Paso para "Arreglar" el Usuario (Opcional - Nivel Experto)

Si quieres activar la seguridad RLS real en producción:

1.  Conéctate a tu DB como admin (`postgres`).
2.  Crea un usuario para la app:
    ```sql
    CREATE USER ynab_app WITH PASSWORD 'super_secure_password';
    GRANT ALL PRIVILEGES ON DATABASE ynab_db TO ynab_app;
    -- IMPORTANTE: No le des SUPERUSER ni BYPASSRLS
    GRANT ALL ON ALL TABLES IN SCHEMA public TO ynab_app;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO ynab_app;
    ```
3.  Actualiza la variable de entorno `DATABASE_URL` en Coolify para usar `ynab_app` en lugar de `postgres`.
4.  Redespliega.

Ahora, si ejecutas el script de verificación, verás `✅ User is restricted (RLS will be enforced)`.

## Verificación Manual de Emergencia (Imágenes Docker Mínimas)

Si la imagen Docker de producción es mínima (como Alpine) y carece de `node`, `npm` o `tsx`, el script automatizado fallará con `sh: ./scripts/...: not found`.

**Usa este método manual en su lugar:**

1.  **Accede al Contenedor de la Base de Datos:**

    ```bash
    # Encuentra el ID del contenedor postgres
    docker ps | grep postgres

    # Entra al contenedor
    docker exec -it <id_contenedor_postgres> psql -U ynab_app -d ynab_prod
    ```

2.  **Verifica Políticas RLS:**

    ```sql
    -- Debería retornar 't' (true) para todas
    SELECT relname, relrowsecurity
    FROM pg_class
    WHERE relname IN ('accounts', 'budgets', 'transactions');
    ```

3.  **Verifica Esquema (ej: columna budget_id):**

    ```sql
    \d transactions
    -- Busca: "budget_id | integer | not null"
    ```

4.  **Verifica Salud de la Aplicación:**
    ```bash
    docker logs --tail 20 <id_contenedor_app>
    -- Busca "Ready" y ausencia de errores SQL
    ```
