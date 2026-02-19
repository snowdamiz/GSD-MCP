# Decimal Phase Calculation

Calculate the next decimal phase number for urgent insertions.

## Using the gsd_phase_next_decimal Tool

Call the `gsd_phase_next_decimal` tool with the base phase number (e.g., `6`).

It returns JSON with:

```json
{
  "found": true,
  "base_phase": "06",
  "next": "06.1",
  "existing": []
}
```

With existing decimals:
```json
{
  "found": true,
  "base_phase": "06",
  "next": "06.3",
  "existing": ["06.1", "06.2"]
}
```

## Extract Values

From the tool response, use:
- `next` — the next available decimal phase number (e.g., `"06.1"`)
- `base_phase` — the zero-padded base phase (e.g., `"06"`)

## Examples

| Existing Phases | Next Phase |
|-----------------|------------|
| 06 only | 06.1 |
| 06, 06.1 | 06.2 |
| 06, 06.1, 06.2 | 06.3 |
| 06, 06.1, 06.3 (gap) | 06.4 |

## Directory Naming

Decimal phase directories use the full decimal number. Call the `gsd_generate_slug` tool with the description to get a URL-safe slug, then construct the directory path:

```
.planning/phases/${DECIMAL_PHASE}-${SLUG}/
```

Example: `.planning/phases/06.1-fix-critical-auth-bug/`
