# Phase Argument Parsing

Parse and normalize phase arguments for tools that operate on phases.

## Extraction

From the `<arguments>` JSON block:
- Extract phase number (from the `phase` field)
- Extract flags (additional fields in the JSON)
- Remaining text is description (for insert/add tools)

## Using the gsd_find_phase Tool

Call the `gsd_find_phase` tool to handle normalization and validation in one step. Pass the phase number and it returns JSON with:

- `found`: true/false
- `directory`: Full path to phase directory
- `phase_number`: Normalized number (e.g., "06", "06.1")
- `phase_name`: Name portion (e.g., "foundation")
- `plans`: Array of PLAN.md files
- `summaries`: Array of SUMMARY.md files

## Manual Normalization (Legacy)

Zero-pad integer phases to 2 digits. Preserve decimal suffixes.

- Integer: `8` becomes `08`
- Decimal: `2.1` becomes `02.1`

## Validation

Call the `gsd_roadmap_get_phase` tool with the phase number to validate the phase exists. If the result has `found: false`, the phase does not exist in the roadmap.

## Directory Lookup

Call the `gsd_find_phase` tool with the phase number to get the directory path from the result.
