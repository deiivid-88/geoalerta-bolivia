"""Matriz de permisos por rol. Debe coincidir con src/domain/permissions.ts (lo verifica un test)."""

BASE_READ = {
    "dashboard.view",
    "map.view",
    "records.view",
    "reports.view",
    "satellite.view",
    "sources.view",
    "analysis.view",
    "alerts.view",
    "informes.generate",
}

ROLE_PERMISSIONS: dict[str, frozenset[str]] = {
    "administrador": frozenset(
        BASE_READ
        | {
            "records.create", "records.edit", "records.classify", "records.delete", "records.import", "records.export",
            "evidence.upload", "reports.review", "reports.view_sensitive", "satellite.create", "satellite.review",
            "satellite.verify_documental", "sources.manage", "alerts.manage", "alerts.derive", "audit.view",
            "admin.users", "admin.settings",
        }
    ),
    "analista_sig": frozenset(
        BASE_READ
        | {"records.create", "records.edit", "records.import", "records.export", "evidence.upload", "satellite.create", "satellite.review", "alerts.manage"}
    ),
    "revisor_institucional": frozenset(
        BASE_READ
        | {
            "records.edit", "records.classify", "records.export", "evidence.upload", "reports.review", "reports.view_sensitive",
            "satellite.verify_documental", "alerts.manage", "alerts.derive", "audit.view",
        }
    ),
    "consulta_institucional": frozenset(BASE_READ),
}


def can(role: str | None, permission: str) -> bool:
    return bool(role) and permission in ROLE_PERMISSIONS.get(role, frozenset())
