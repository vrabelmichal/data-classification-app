# Agents Guidance

## Constants

Avoid hardcoding the same numeric value in multiple places.

Prefer:

- app settings / database config
- shared defaults in a dedicated source file
- as a last resort, file-level constants

## Convex database guidance

For Convex-related database implementation, follow the guidance in `.cursor/rules/convex_rules.mdc`.
