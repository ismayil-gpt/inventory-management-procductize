# Restore test — 2026-10-01 12:30 +04

Run by `scripts/verify-backup-restore.sh` (DESC control 17).

- **Result: PASS**
- Backup file: `mizan-20261001-123014.dump.enc` (552K, AES-256, checksum verified before restore)
- Restored into a throwaway database, dropped afterwards
- Append-only rules present after restore: 4 of 4 (control 10)
- Total time, backup plus restore plus checks: 4s

| Table | Live rows | Restored rows |
|---|---:|---:|
| AuditLog | 166 | 166 |
| CycleCount | 5 | 5 |
| CycleCountLine | 22 | 22 |
| LocationNode | 111 | 111 |
| LocationType | 3 | 3 |
| Organization | 1 | 1 |
| Product | 75 | 75 |
| ProductAttributeDefinition | 0 | 0 |
| ProductCategory | 9 | 9 |
| PurchaseOrder | 1 | 1 |
| Recommendation | 8 | 8 |
| StockMovement | 13067 | 13067 |
| StockPosition | 83 | 83 |
| Supplier | 7 | 7 |
| UnitOfMeasure | 7 | 7 |
| User | 2 | 2 |
| _prisma_migrations | 3 | 3 |
