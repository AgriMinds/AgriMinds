"""Sync risk_snapshots and sample advisories to Railway database."""

import asyncio
import asyncpg

LOCAL_PG = {
    'user': 'agriminds',
    'password': 'hmB3a1REfb9Lk66jcY7z34WJhWfOaUfA',
    'host': '127.0.0.1',
    'port': 5432,
    'database': 'agriminds'
}

REMOTE_PG = {
    'user': 'postgres',
    'password': 'IJqTIaONmJYYpnVYpoQQNnqSvJNtSSFE',
    'host': 'acela.proxy.rlwy.net',
    'port': 38952,
    'database': 'railway'
}

async def main():
    conn_local = await asyncpg.connect(**LOCAL_PG)
    conn_remote = await asyncpg.connect(**REMOTE_PG)
    print("Connected to local agriminds and remote railway DBs.")

    # 1. Sync risk_snapshots
    local_snapshots = await conn_local.fetch('SELECT * FROM risk_snapshots ORDER BY issued_date, lead_month, grid_row, grid_col')
    print(f"Fetched {len(local_snapshots)} local risk_snapshots.")

    await conn_remote.execute('DELETE FROM risk_snapshots')
    cols = [
        'id', 'issued_date', 'target_month', 'model_version', 'data_source',
        'lead_month', 'grid_row', 'grid_col', 'latitude', 'longitude',
        'probability', 'risk_level', 'pdsi', 'pdsi_category',
        'created_at', 'updated_at', 'in_watershed'
    ]
    
    records = [[r[c] for c in cols] for r in local_snapshots]
    await conn_remote.copy_records_to_table(
        'risk_snapshots',
        records=records,
        columns=cols
    )
    remote_rs_count = await conn_remote.fetchval('SELECT count(*) FROM risk_snapshots')
    print(f"✓ Copied {remote_rs_count} risk_snapshots to Railway!")

    # 2. Sync advisory_records
    farms_remote = await conn_remote.fetch('SELECT id, owner_id, primary_crop FROM farms')
    print(f"Found {len(farms_remote)} farms on Railway.")

    if farms_remote:
        await conn_remote.execute('DELETE FROM advisory_records')
        import datetime, uuid
        adv_records = []
        # Create advisory records for multiple lead months (1, 2, 3) across farms
        for f in farms_remote:
            for lead in [1, 2, 3]:
                raw_prob = 0.18 + (lead * 0.12) if (str(f['id'])[-1] in '012345') else 0.45 + (lead * 0.08)
                raw_prob = min(0.85, round(raw_prob, 3))
                adj_prob = round(raw_prob * 0.95, 3)
                risk_lvl = 'Low' if raw_prob < 0.30 else ('Moderate' if raw_prob < 0.55 else ('High' if raw_prob < 0.75 else 'Severe'))
                target_m = datetime.date(2026, 6 + lead, 1) if lead <= 6 else datetime.date(2026, 12, 1)
                is_ack = (str(f['id'])[-1] in '02468')
                ack_time = datetime.datetime(2026, 6, 2, 10, 0, tzinfo=datetime.timezone.utc) if is_ack else None
                created_t = datetime.datetime(2026, 6, 1, 6, 0, tzinfo=datetime.timezone.utc)

                adv_records.append((
                    uuid.uuid4(),
                    f['id'],
                    f['owner_id'],
                    f['primary_crop'],
                    lead,
                    datetime.date(2026, 6, 1),
                    target_m,
                    raw_prob,
                    adj_prob,
                    risk_lvl,
                    'superhybrid-0.1.0',
                    '2026.10-draft',
                    'synthetic',
                    ack_time,
                    created_t,
                    created_t
                ))

        adv_cols = [
            'id', 'farm_id', 'user_id', 'crop', 'lead_month',
            'issued_date', 'target_month', 'raw_probability',
            'adjusted_probability', 'risk_level', 'model_version',
            'rules_version', 'data_source', 'acknowledged_at',
            'created_at', 'updated_at'
        ]
        await conn_remote.copy_records_to_table(
            'advisory_records',
            records=adv_records,
            columns=adv_cols
        )
        remote_adv_count = await conn_remote.fetchval('SELECT count(*) FROM advisory_records')
        print(f"✓ Created {remote_adv_count} advisory_records on Railway!")

    # 3. Verify views in analytics schema
    fact_risk = await conn_remote.fetchval('SELECT count(*) FROM analytics.fact_risk')
    fact_farm_risk = await conn_remote.fetchval('SELECT count(*) FROM analytics.fact_farm_risk')
    fact_advisory = await conn_remote.fetchval('SELECT count(*) FROM analytics.fact_advisory')
    print(f"✓ analytics.fact_risk: {fact_risk} rows")
    print(f"✓ analytics.fact_farm_risk: {fact_farm_risk} rows")
    print(f"✓ analytics.fact_advisory: {fact_advisory} rows")

    await conn_local.close()
    await conn_remote.close()

if __name__ == '__main__':
    asyncio.run(main())
