#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────
#  CI Guard: Detect hardcoded locale strings in test files
# ──────────────────────────────────────────────────────────
#
#  Scans E2E spec files for common hardcoded UI strings
#  (Spanish AND English) that should use t() / tLocale()
#  from i18n-helpers.ts.
#
#  Usage:  npm run check:locale-strings
#  Exit:   0 if clean, 1 if violations found
# ──────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TESTS_DIR="$ROOT_DIR/tests"

# Common Spanish UI strings that should NOT appear hardcoded in tests.
PATTERNS=(
  "Contraseña"
  "Iniciar Sesión"
  "Crear Cuenta"
  "Cerrar"
  "Importar Datos"
  "Importación Exitosa"
  "Configuración de Perfil"
  "Mis Presupuestos"
  "Crear Nuevo Presupuesto"
  "Crear Presupuesto"
  "Nombre del presupuesto"
  "Guardar Cambios"
  "Agregar Cuenta"
  "Grupo de Categoría"
  "Crear Grupo"
  "Gastos Mensuales"
  "Beneficiario"
  "Categoría"
  "Monto total"
  "Selecciona cuenta"
  "Compartir presupuesto"
  "Invitar por email"
  "Auto-Asignar"
  "Disponible"
  "Información Personal"
  "Cambiar Contraseña"
  "Guardar Perfil"
  "Idioma"
)

# Common English UI strings that should NOT appear hardcoded in tests.
# Short strings (Email, Save, etc.) are excluded to avoid false positives.
ENGLISH_PATTERNS=(
  "Cleared Balance"
  "Working Balance"
  "Reconcile Account"
  "Verify Balance"
  "Add Transaction"
  "Ready to Assign"
  "Register CSV"
  "Plan CSV"
  "Incorrect password"
  "Create Account"
  "Create Budget"
  "Import Data"
)

VIOLATIONS=0
VIOLATION_FILES=()

# Scan for both Spanish and English patterns
ALL_PATTERNS=("${PATTERNS[@]}" "${ENGLISH_PATTERNS[@]}")

for pattern in "${ALL_PATTERNS[@]}"; do
  # Search .spec.ts files, excluding:
  # - Comments (lines where content after filename:linenum: starts with // or *)
  # - String literals in const/template data (CSV content, test data)
  matches=$(grep -rn "$pattern" "$TESTS_DIR"/*.spec.ts "$TESTS_DIR"/*.setup.ts 2>/dev/null \
    | grep -v '^\([^:]*:[0-9]*:\)\s*//' \
    | grep -v '^\([^:]*:[0-9]*:\)\s*\*' \
    | grep -v '^\([^:]*:[0-9]*:\)\s*#' \
    | grep -v '^\([^:]*:[0-9]*:\)\s*\"' \
    | grep -v 'const.*CSV.*=' \
    | grep -v "test('" \
    | grep -v 'test("' \
    || true)
  
  if [ -n "$matches" ]; then
    VIOLATIONS=$((VIOLATIONS + 1))
    echo "❌ Hardcoded string found: \"$pattern\""
    echo "$matches" | sed 's/^/   /'
    echo ""
    # Track unique files
    while IFS= read -r line; do
      file=$(echo "$line" | cut -d: -f1)
      if [[ ! " ${VIOLATION_FILES[*]:-} " =~ " ${file} " ]]; then
        VIOLATION_FILES+=("$file")
      fi
    done <<< "$matches"
  fi
done

echo "──────────────────────────────────────────"
if [ "$VIOLATIONS" -gt 0 ]; then
  echo "❌ Found $VIOLATIONS hardcoded locale pattern(s) in ${#VIOLATION_FILES[@]} file(s)."
  echo ""
  echo "Fix: Use t('key') from tests/i18n-helpers.ts instead of hardcoded strings."
  echo "     import { t } from './i18n-helpers';"
  echo ""
  exit 1
else
  echo "✅ No hardcoded locale strings found in test files."
  exit 0
fi
