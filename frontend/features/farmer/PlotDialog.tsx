'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Trash2, TriangleAlert, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { Crop, Farm, LeadMonth } from '@agriminds/api-types'
import { CROPS } from '@agriminds/api-types'
import { Button } from '@/components/ui/button'
import { SegmentedControl } from '@/components/ui/segmented'
import { ApiError } from '@/lib/api/client'
import { useFarmMutations } from '@/features/farmer/useFarmer'
import { cn } from '@/lib/utils'

const FIELD =
  'h-12 w-full rounded-xl border border-border bg-surface px-3.5 text-base text-fg shadow-xs placeholder:text-fg-subtle focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'

type Props = { farm: Farm | null; lead: LeadMonth; onClose: () => void }

/** Create or edit one plot. A plot outside the modelled watershed is rejected by the API. */
export function PlotDialog({ farm, lead, onClose }: Props) {
  const t = useTranslations('farmer')
  const ta = useTranslations('advisory')
  const tc = useTranslations('common')
  const { create, update, remove } = useFarmMutations(lead)
  const dialogRef = useRef<HTMLDivElement>(null)
  const firstFieldRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState(farm?.name ?? '')
  const [latitude, setLatitude] = useState(farm ? String(farm.latitude) : '')
  const [longitude, setLongitude] = useState(farm ? String(farm.longitude) : '')
  const [area, setArea] = useState(farm ? String(farm.area_hectares) : '')
  const [crop, setCrop] = useState<Crop>((farm?.primary_crop as Crop) ?? 'tef')
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const busy = create.isPending || update.isPending || remove.isPending

  useEffect(() => {
    firstFieldRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  function invalid(): string | null {
    if (!name.trim()) return t('errors.nameRequired')
    const lat = Number(latitude)
    const lon = Number(longitude)
    const ha = Number(area)
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) return t('errors.latitude')
    if (!Number.isFinite(lon) || lon < -180 || lon > 180) return t('errors.longitude')
    if (!Number.isFinite(ha) || ha <= 0) return t('errors.area')
    return null
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    const message = invalid()
    if (message) return setError(message)
    setError(null)
    const payload = {
      name: name.trim(),
      latitude: Number(latitude),
      longitude: Number(longitude),
      area_hectares: Number(area),
      primary_crop: crop,
    }
    try {
      if (farm) await update.mutateAsync({ id: farm.id, payload })
      else await create.mutateAsync(payload)
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('errors.generic'))
    }
  }

  async function onDelete() {
    if (!farm) return
    try {
      await remove.mutateAsync(farm.id)
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('errors.generic'))
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-brand-forest-deep/60 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      onPointerDown={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="plot-dialog-title"
        className="max-h-[92svh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-border bg-surface-raised p-5 shadow-lg sm:rounded-2xl sm:p-6"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id="plot-dialog-title" className="font-display text-lg font-semibold">
            {farm ? t('editPlot') : t('addPlot')}
          </h2>
          <Button variant="ghost" size="icon-sm" aria-label={tc('close')} onClick={onClose} disabled={busy}>
            <X />
          </Button>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="plot-name" className="text-sm font-semibold">
              {t('plotName')}
            </label>
            <input
              id="plot-name"
              ref={firstFieldRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={FIELD}
              maxLength={120}
              required
              disabled={busy}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="plot-lat" className="text-sm font-semibold">
                {t('latitude')}
              </label>
              <input
                id="plot-lat"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                className={FIELD}
                inputMode="decimal"
                placeholder="10.95"
                required
                disabled={busy}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="plot-lon" className="text-sm font-semibold">
                {t('longitude')}
              </label>
              <input
                id="plot-lon"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                className={FIELD}
                inputMode="decimal"
                placeholder="37.95"
                required
                disabled={busy}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="plot-area" className="text-sm font-semibold">
              {t('area')}
            </label>
            <input
              id="plot-area"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              className={FIELD}
              inputMode="decimal"
              placeholder="1.5"
              required
              disabled={busy}
            />
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-semibold">{ta('targetCrop')}</legend>
            <SegmentedControl
              aria-label={ta('targetCrop')}
              variant="tile"
              value={crop}
              onChange={setCrop}
              options={CROPS.map((c) => ({ value: c, label: ta(`crops.${c}.label`), hint: ta(`crops.${c}.desc`) }))}
            />
          </fieldset>

          {error && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-status-bad/40 bg-status-bad/10 px-3.5 py-3 text-sm"
            >
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-status-bad" aria-hidden />
              <span>{error}</span>
            </p>
          )}

          <div className={cn('flex flex-col gap-2 pt-1 sm:flex-row-reverse sm:items-center')}>
            <Button type="submit" size="lg" className="h-12 flex-1" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              {farm ? t('saveChanges') : t('addPlot')}
            </Button>
            <Button type="button" variant="outline" size="lg" className="h-12" onClick={onClose} disabled={busy}>
              {tc('cancel')}
            </Button>
            {farm && (
              <Button
                type="button"
                variant={confirmDelete ? 'default' : 'ghost'}
                size="lg"
                className={cn('h-12 sm:mr-auto', confirmDelete && 'bg-status-bad text-white')}
                disabled={busy}
                onClick={() => (confirmDelete ? onDelete() : setConfirmDelete(true))}
              >
                <Trash2 /> {confirmDelete ? t('confirmDelete') : t('deletePlot')}
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
