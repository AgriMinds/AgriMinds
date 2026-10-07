'use client'

import { Bar, BarChart, CartesianGrid, Line, LineChart, Pie, PieChart, XAxis, YAxis } from 'recharts'
import { Activity, Download, FileBarChart, MapPinned, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Button } from '@/components/ui/button'

const trendData = [
  { month: 'May', rainfall: 42, coverage: 54 }, { month: 'Jun', rainfall: 55, coverage: 61 },
  { month: 'Jul', rainfall: 68, coverage: 72 }, { month: 'Aug', rainfall: 74, coverage: 78 },
  { month: 'Sep', rainfall: 63, coverage: 86 }, { month: 'Oct', rainfall: 58, coverage: 91 },
]
const regionData = [
  { region: 'Oromia', risk: 68 }, { region: 'Amhara', risk: 54 }, { region: 'Somali', risk: 81 },
  { region: 'SNNPR', risk: 46 }, { region: 'Tigray', risk: 39 },
]
const responseData = [{ name: 'Monitored', value: 72, fill: 'var(--color-monitored)' }, { name: 'Needs action', value: 28, fill: 'var(--color-action)' }]
const chartConfig = {
  rainfall: { label: 'Rainfall index', color: 'var(--chart-1)' },
  coverage: { label: 'Farmer coverage', color: 'var(--chart-2)' },
  risk: { label: 'Risk index', color: 'var(--chart-3)' },
  monitored: { label: 'Monitored', color: 'var(--chart-1)' },
  action: { label: 'Needs action', color: 'var(--chart-4)' },
}

export function ReportAnalytics() {
  return (
    <section className="mt-6" aria-labelledby="reports-heading">
      <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Reports & briefings</p><h2 id="reports-heading" className="mt-1 text-2xl font-black tracking-tight">National agriculture intelligence</h2><p className="mt-1 text-sm text-slate-500">Evidence for weekly decisions, resource allocation, and field response.</p></div>
        <Button variant="outline" className="gap-2 bg-white"><Download data-icon="inline-start" /> Export briefing</Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-slate-200 shadow-sm lg:col-span-2"><CardHeader><div className="flex items-center justify-between"><div><CardTitle>Seasonal trend</CardTitle><CardDescription>Rainfall conditions and farmer network coverage</CardDescription></div><TrendingUp className="size-5 text-emerald-700" /></div></CardHeader><CardContent><ChartContainer config={chartConfig} className="h-[250px] w-full"><LineChart data={trendData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}><CartesianGrid vertical={false} strokeDasharray="3 3" /><XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} /><YAxis tickLine={false} axisLine={false} width={32} /><ChartTooltip content={<ChartTooltipContent />} /><Line dataKey="rainfall" type="monotone" stroke="var(--color-rainfall)" strokeWidth={3} dot={false} /><Line dataKey="coverage" type="monotone" stroke="var(--color-coverage)" strokeWidth={3} dot={false} /></LineChart></ChartContainer></CardContent></Card>
        <Card className="border-slate-200 shadow-sm"><CardHeader><CardTitle>Response coverage</CardTitle><CardDescription>Active monitoring status</CardDescription></CardHeader><CardContent><ChartContainer config={chartConfig} className="mx-auto h-[210px] w-full"><PieChart><ChartTooltip content={<ChartTooltipContent hideLabel />} /><Pie data={responseData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={88} strokeWidth={5} /></PieChart></ChartContainer><div className="-mt-4 text-center"><p className="text-3xl font-black text-slate-900">72%</p><p className="text-xs text-slate-500">districts monitored</p></div></CardContent></Card>
        <Card className="border-slate-200 shadow-sm lg:col-span-2"><CardHeader><div className="flex items-center justify-between"><div><CardTitle>Regional risk comparison</CardTitle><CardDescription>Composite drought and farmer impact index</CardDescription></div><MapPinned className="size-5 text-emerald-700" /></div></CardHeader><CardContent><ChartContainer config={chartConfig} className="h-[250px] w-full"><BarChart data={regionData} layout="vertical" margin={{ left: 12, right: 12 }}><CartesianGrid horizontal={false} /><XAxis type="number" domain={[0, 100]} hide /><YAxis dataKey="region" type="category" tickLine={false} axisLine={false} width={65} /><ChartTooltip cursor={false} content={<ChartTooltipContent />} /><Bar dataKey="risk" fill="var(--color-risk)" radius={6} barSize={22} /></BarChart></ChartContainer></CardContent></Card>
        <Card className="border-slate-200 shadow-sm"><CardHeader><CardTitle>Briefing pulse</CardTitle><CardDescription>Signals requiring attention</CardDescription></CardHeader><CardContent><div className="flex flex-col gap-4"><div className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700"><Activity className="size-5" /></div><div><p className="text-sm font-bold">12 open reports</p><p className="text-xs text-slate-500">4 updated today</p></div></div><div className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><FileBarChart className="size-5" /></div><div><p className="text-sm font-bold">98% data quality</p><p className="text-xs text-slate-500">Across 84 districts</p></div></div></div></CardContent></Card>
      </div>
    </section>
  )
}
    
