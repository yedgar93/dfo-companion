# Contributing

Use existing snapshots for UI features; do not add game reads to map drawing, item comparisons, tooltips, service searches or update checks. Avoid full synchronous copies during play. Keep desktop renderer sandboxing and local endpoint restrictions intact. Tests must not attach to a live game. Increment the package version for a release and keep Mac and Windows icons consistent.
