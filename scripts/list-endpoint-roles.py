#!/usr/bin/env python3
"""Lists every API endpoint with the role it requires, read from the NestJS
controllers (@Controller, @Get/@Post/@Patch/@Delete/@Put, @Roles). Used to keep
documentation/security-compliance/access-control-model.md accurate (DESC #8).

    python3 scripts/list-endpoint-roles.py            # tab-separated
    python3 scripts/list-endpoint-roles.py --markdown # table rows
"""
import glob
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PUBLIC_AUTH = {'login', 'refresh', 'mfa/verify', 'mfa/enroll/start', 'mfa/enroll/confirm'}
LABEL = {'public': 'Public', 'any': 'Any signed-in user', 'ADMIN': 'Administrator only'}

rows = []
for path in sorted(glob.glob(str(ROOT / 'backend/src/modules/**/*.controller.ts'), recursive=True)):
    source = Path(path).read_text()
    controller = re.search(r"@Controller\(\s*'?([^')]*)'?\s*\)", source)
    base = (controller.group(1) if controller else '').strip('/')
    class_roles = re.search(r"@Roles\(([^)]*)\)\s*(?:@\w+\([^)]*\)\s*)*export class", source)
    for m in re.finditer(r"@(Get|Post|Patch|Delete|Put)\(\s*(?:'([^']*)')?\s*\)((?:\s*@[\w.]+\([^\n]*\))*)", source):
        sub = (m.group(2) or '').strip('/')
        method_roles = re.search(r"@Roles\(([^)]*)\)", m.group(3))
        roles = (method_roles.group(1) if method_roles else (class_roles.group(1) if class_roles else '')).replace('Role.', '').replace(' ', '')
        is_public = (base == 'auth' and sub in PUBLIC_AUTH) or base in ('health', 'system')
        access = 'public' if is_public else (roles or 'any')
        endpoint = '/api/v1/' + '/'.join(p for p in (base, sub) if p)
        row = (base, m.group(1).upper(), endpoint, access)
        if row not in rows:
            rows.append(row)

for base, verb, endpoint, access in rows:
    if '--markdown' in sys.argv:
        print(f'| {base} | {verb} | `{endpoint}` | {LABEL.get(access, access)} |')
    else:
        print(f'{verb}\t{endpoint}\t{access}')
