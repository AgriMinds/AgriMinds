'use client'

import { useEffect, useState } from 'react'
import { Bell, ChevronDown, CircleHelp, CloudSun, FileText, LayoutDashboard, Leaf, Menu, MessageSquare, Settings, ShieldCheck, Sprout, Users, X } from 'lucide-react'
import { Navbar } from '@/components/layout/Navbar'
import { WatershedSummary } from '@/components/stats/WatershedSummary'
import { WatershedGridMap } from '@/components/drought/WatershedGridMap'
import { CropDecisionPanel } from '@/components/advisory/CropDecisionPanel'
import { EnsoMonitor } from '@/components/enso/EnsoMonitor'
import { ReportAnalytics } from '@/components/reports/ReportAnalytics'
import { fetchDroughtMap, evaluateAdvisory, fetchEnsoOutlook, fetchHealth } from '@/lib/api'
import type { AdvisoryResponse, DroughtMapResponse, EnsoOutlookResponse } from '@/types'
import { Language, translations } from '@/lib/translations'

const navigation = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Drought intelligence', icon: CloudSun },
  { label: 'Crop advisories', icon: Sprout },
  { label: 'Farmer network', icon: Users },
  { label: 'Reports & briefings', icon: FileText },
]

export default function DashboardPage() {
  const [language, setLanguage] = useState<Language>('en')
  const [apiStatus, setApiStatus] = useState<'healthy' | 'offline' | 'loading'>('loading')
  const [selectedLead, setSelectedLead] = useState(1)
  const [selectedCell, setSelectedCell] = useState({ row: 4, col: 4 })
  const [crop, setCrop] = useState<'tef' | 'wheat' | 'maize'>('tef')
  const [iekAgrees, setIekAgrees] = useState<boolean | null>(null)
  const [mapData, setMapData] = useState<DroughtMapResponse | null>(null)
  const [advisory, setAdvisory] = useState<AdvisoryResponse | null>(null)
  const [ensoData, setEnsoData] = useState<EnsoOutlookResponse | null>(null)
  const [isMapLoading, setIsMapLoading] = useState(true)
  const [isAdvLoading, setIsAdvLoading] = useState(true)
  const [isEnsoLoading, setIsEnsoLoading] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  const t = translations[language]

  useEffect(() => {
    fetchHealth().then((health) => setApiStatus(health.status === 'healthy' ? 'healthy' : 'offline'))
    fetchEnsoOutlook().then(setEnsoData).catch(() => undefined).finally(() => setIsEnsoLoading(false))
  }, [])

  useEffect(() => {
    setIsMapLoading(true)
    fetchDroughtMap(selectedLead).then(setMapData).catch(() => undefined).finally(() => setIsMapLoading(false))
  }, [selectedLead])

  useEffect(() => {
    setIsAdvLoading(true)
    evaluateAdvisory({ crop, lead_month: selectedLead, row: selectedCell.row, col: selectedCell.col, iek_agrees: iekAgrees })
      .then(setAdvisory).catch(() => undefined).finally(() => setIsAdvLoading(false))
  }, [crop, selectedLead, selectedCell, iekAgrees])

  return (
    <div className="min-h-screen bg-[#f7f8f4] text-slate-900 transition-colors dark:bg-[#183129] dark:text-emerald-50">
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col bg-[#173f36] text-white shadow-2xl transition-transform duration-300 lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
          <div className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-xl bg-[#d6e85f] text-[#173f36]"><Leaf className="size-5" /></div><div><div className="font-black tracking-tight">AgriMinds</div><div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b7d4b5]">AI-DREWS</div></div></div>
          <button className="rounded-lg p-2 text-white/70 hover:bg-white/10 lg:hidden" aria-label="Close navigation" onClick={() => setMobileOpen(false)}><X className="size-5" /></button>
        </div>
        <div className="mx-4 mt-5 rounded-2xl border border-white/10 bg-white/[0.07] p-3"><div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#b7d4b5]"><ShieldCheck className="size-3.5" /> Workspace</div><button className="flex w-full items-center justify-between text-left"><span><span className="block text-sm font-semibold">Ministry command center</span><span className="block text-xs text-white/55">Federal agriculture</span></span><ChevronDown className="size-4 text-white/50" /></button></div>
        <nav className="flex-1 px-4 py-6" aria-label="Main navigation"><p className="px-3 pb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">Navigation</p><div className="flex flex-col gap-1">{navigation.map((item, index) => { const Icon = item.icon; return <button key={item.label} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${index === 0 ? 'bg-[#d6e85f] text-[#173f36] shadow-lg shadow-black/10' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}><Icon className="size-[18px]" />{item.label}{item.label === 'Reports & briefings' && <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[10px]">12</span>}</button> })}</div><p className="px-3 pb-3 pt-8 text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">Administration</p><div className="flex flex-col gap-1"><button className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white"><MessageSquare className="size-[18px]" />Field feedback<span className="ml-auto size-2 rounded-full bg-[#e7b56c]" /></button><button className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white"><Settings className="size-[18px]" />Settings</button></div></nav>
        <div className="border-t border-white/10 p-4"><div className="flex items-center gap-3 rounded-xl p-2"><div className="flex size-9 items-center justify-center rounded-full bg-[#c98957] text-sm font-bold">MA</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">Minister&apos;s office</p><p className="truncate text-xs text-white/50">admin@moa.gov.et</p></div><button aria-label="Help" className="text-white/45 hover:text-white"><CircleHelp className="size-4" /></button></div></div>
      </aside>
      {mobileOpen && <button className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden" aria-label="Close navigation overlay" onClick={() => setMobileOpen(false)} />}
      <div className="lg:pl-[272px]"><div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 transition-colors dark:border-emerald-900/70 dark:bg-[#21483b] lg:hidden"><button className="rounded-lg border border-slate-200 p-2" aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Menu className="size-5" /></button><span className="font-bold">Ministry command center</span></div><Navbar apiStatus={apiStatus} language={language} onLanguageChange={setLanguage} /><main className="mx-auto w-full max-w-[1640px] px-4 py-6 sm:px-6 lg:px-8"><div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">Tuesday, 07 October 2026 · National view</p><h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">Good morning, Minister&apos;s office</h1><p className="mt-2 max-w-2xl text-sm text-slate-500">A clear picture of drought risk, farmer needs, and the decisions that need attention across Ethiopia.</p></div><button className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold shadow-sm hover:bg-slate-50"><Bell className="size-4 text-emerald-700" /> 3 priority updates</button></div><WatershedSummary mapData={mapData} selectedLead={selectedLead} language={language} /><div className="mt-6 grid grid-cols-1 items-start gap-6 xl:grid-cols-12"><div className="xl:col-span-5"><WatershedGridMap mapData={mapData} selectedLead={selectedLead} onLeadChange={setSelectedLead} selectedCell={selectedCell} onCellSelect={(row, col) => setSelectedCell({ row, col })} isLoading={isMapLoading} language={language} /></div><div className="xl:col-span-7"><CropDecisionPanel crop={crop} onCropChange={setCrop} iekAgrees={iekAgrees} onIekChange={setIekAgrees} advisory={advisory} isLoading={isAdvLoading} language={language} /></div></div><div className="mt-6"><EnsoMonitor ensoData={ensoData} isLoading={isEnsoLoading} language={language} /></div><ReportAnalytics /></main><footer className="border-t border-slate-200 bg-white px-4 py-5 text-center text-xs text-slate-400 sm:px-6 lg:px-8">Ministry of Agriculture · Federal Democratic Republic of Ethiopia <span className="mx-2">•</span> Decision intelligence for resilient food systems</footer></div>
    </div>
  )
}
