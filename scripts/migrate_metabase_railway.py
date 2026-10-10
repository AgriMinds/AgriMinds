"""Script to sync Metabase dashboard cards and settings from local to Railway."""

import asyncio
import json
import secrets
import string
import asyncpg

LOCAL_PG = {
    'user': 'agriminds',
    'password': 'hmB3a1REfb9Lk66jcY7z34WJhWfOaUfA',
    'host': '127.0.0.1',
    'port': 5432,
    'database': 'metabase'
}

REMOTE_PG = {
    'user': 'postgres',
    'password': 'IJqTIaONmJYYpnVYpoQQNnqSvJNtSSFE',
    'host': 'acela.proxy.rlwy.net',
    'port': 38952,
    'database': 'metabase'
}

def generate_entity_id(length=21):
    chars = string.ascii_letters + string.digits + '_-'
    return ''.join(secrets.choice(chars) for _ in range(length))

async def main():
    conn_local = await asyncpg.connect(**LOCAL_PG)
    conn_remote = await asyncpg.connect(**REMOTE_PG)
    print("Connected to both local and Railway Metabase databases.")

    # 1. Update custom-geojson setting
    geojson = {
        'choke-grid': {
            'name': 'Choke watershed forecast grid',
            'url': 'https://backend-production-ced6.up.railway.app/api/v1/geo/grid.geojson',
            'region_key': 'cell',
            'region_name': 'cell'
        }
    }
    await conn_remote.execute(
        'INSERT INTO setting ("key", "value") VALUES ($1, $2) '
        'ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value"',
        'custom-geojson', json.dumps(geojson)
    )
    print("✓ Updated custom-geojson setting.")

    # 2. Get local cards and dashcards
    local_cards = await conn_local.fetch(
        'SELECT * FROM report_card WHERE id IN (27, 28, 29, 30, 31, 32) ORDER BY id'
    )
    local_dashcards = await conn_local.fetch(
        'SELECT * FROM report_dashboardcard WHERE dashboard_id = 2 ORDER BY id'
    )
    print(f"Found {len(local_cards)} cards and {len(local_dashcards)} dashcards locally.")

    existing_cards = await conn_remote.fetch('SELECT id, name FROM report_card')
    name_to_id = {c['name']: c['id'] for c in existing_cards}

    card_map = {}
    for lc in local_cards:
        if lc['name'] in name_to_id:
            rid = name_to_id[lc['name']]
            print(f"  • Card already exists: '{lc['name']}' -> remote ID {rid}")
            card_map[lc['id']] = rid
        else:
            row = await conn_remote.fetchrow(
                """
                INSERT INTO report_card (
                    created_at, updated_at, name, description, display,
                    dataset_query, visualization_settings, creator_id,
                    database_id, query_type, archived, enable_embedding, entity_id
                ) VALUES (
                    NOW(), NOW(), $1, $2, $3,
                    $4, $5, 1,
                    2, $6, false, true, $7
                ) RETURNING id
                """,
                lc['name'], lc['description'], lc['display'],
                lc['dataset_query'], lc['visualization_settings'], lc['query_type'],
                generate_entity_id()
            )
            rid = row['id']
            print(f"  + Created card: '{lc['name']}' -> new remote ID {rid}")
            card_map[lc['id']] = rid

    # 3. Attach dashcards to Dashboard 2
    await conn_remote.execute('DELETE FROM report_dashboardcard WHERE dashboard_id = 2')
    for ldc in local_dashcards:
        remote_card_id = card_map.get(ldc['card_id'])
        if remote_card_id:
            await conn_remote.execute(
                """
                INSERT INTO report_dashboardcard (
                    created_at, updated_at, dashboard_id, card_id,
                    col, row, size_x, size_y, visualization_settings, parameter_mappings, entity_id
                ) VALUES (
                    NOW(), NOW(), 2, $1,
                    $2, $3, $4, $5, $6, $7, $8
                )
                """,
                remote_card_id, ldc['col'], ldc['row'], ldc['size_x'], ldc['size_y'],
                ldc['visualization_settings'], ldc['parameter_mappings'], generate_entity_id()
            )

    # 4. Verify Dashboard 2
    count = await conn_remote.fetchval('SELECT count(*) FROM report_dashboardcard WHERE dashboard_id = 2')
    print(f"✓ Successfully attached {count} dashcards to Dashboard 2 on Railway Metabase!")

    await conn_local.close()
    await conn_remote.close()

if __name__ == '__main__':
    asyncio.run(main())
