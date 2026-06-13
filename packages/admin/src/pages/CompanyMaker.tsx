import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { api } from '../api'
import { PageHeader } from '../layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { cn } from '../lib/utils'

type Step = 1 | 2 | 3 | 4 | 5

const DEFAULT_STAGES = [
  { name: 'New', color: '#9E9E9E' },
  { name: 'Contacted', color: '#4FC3F7' },
  { name: 'Qualified', color: '#F57C00' },
  { name: 'Proposal', color: '#FFD54F' },
  { name: 'Negotiation', color: '#7C4DFF' },
  { name: 'Won', color: '#2E7D32' },
  { name: 'Lost', color: '#D32F2F' },
]

export default function CompanyMaker() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>(1)
  const [deploying, setDeploying] = useState(false)
  const [company, setCompany] = useState({ name: '', address: '', phone: '', email: '' })
  const [admin, setAdmin] = useState({ name: '', email: '', password: '' })
  const [stages, setStages] = useState(DEFAULT_STAGES.map(s => ({ ...s })))
  const [subdomain, setSubdomain] = useState('')

  const canNext = (): boolean => {
    if (step === 1) return !!company.name.trim()
    if (step === 2) return !!admin.email.trim() && !!admin.password.trim()
    if (step === 3) return stages.length >= 2
    if (step === 4) return !!subdomain.trim()
    return true
  }

  const next = () => { if (canNext()) setStep((step + 1) as Step) }
  const prev = () => setStep((step - 1) as Step)

  const handleDeploy = async () => {
    setDeploying(true)
    const r = await api.post('/api/admin/company-maker/deploy', {
      company: { name: company.name, address: company.address || undefined, phone: company.phone || undefined, email: company.email || undefined },
      adminUser: { name: admin.name || undefined, email: admin.email, password: admin.password },
      stages: stages.map(s => ({ name: s.name, color: s.color })),
      subdomain: subdomain.toLowerCase().replace(/[^a-z0-9-]/g, ''),
    }).catch(() => null)
    setDeploying(false)
    if (r?.ok) {
      toast.success('Company deployed')
      navigate('/server/companies')
    } else toast.error(r?.error || 'Deploy failed')
  }

  return (
    <div className="max-w-xl mx-auto">
      <PageHeader title="Company Maker" description="Deploy a new company with its own CRM workspace" className="text-center sm:text-center" />

      <div className="flex justify-center gap-2 mb-6">
        {([1, 2, 3, 4, 5] as Step[]).map(i => (
          <div
            key={i}
            className={cn(
              'h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold',
              step === i ? 'bg-primary text-white' : i < step ? 'bg-green-600 text-white' : 'bg-muted text-muted-foreground',
            )}
          >
            {i}
          </div>
        ))}
      </div>

      {step === 1 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Step 1: Company Information</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div><Label>Company Name *</Label><Input className="mt-1" value={company.name} onChange={e => setCompany(p => ({ ...p, name: e.target.value }))} /></div>
            <div><Label>Address</Label><Input className="mt-1" value={company.address} onChange={e => setCompany(p => ({ ...p, address: e.target.value }))} /></div>
            <div><Label>Phone</Label><Input className="mt-1" value={company.phone} onChange={e => setCompany(p => ({ ...p, phone: e.target.value }))} /></div>
            <div><Label>Email</Label><Input type="email" className="mt-1" value={company.email} onChange={e => setCompany(p => ({ ...p, email: e.target.value }))} /></div>
            <Button onClick={next} disabled={!canNext()}>Next</Button>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Step 2: Admin User</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div><Label>Name</Label><Input className="mt-1" value={admin.name} onChange={e => setAdmin(p => ({ ...p, name: e.target.value }))} /></div>
            <div><Label>Email *</Label><Input type="email" className="mt-1" value={admin.email} onChange={e => setAdmin(p => ({ ...p, email: e.target.value }))} /></div>
            <div><Label>Password *</Label><Input type="password" className="mt-1" value={admin.password} onChange={e => setAdmin(p => ({ ...p, password: e.target.value }))} /></div>
            <div className="flex gap-2"><Button variant="outline" onClick={prev}>Back</Button><Button onClick={next} disabled={!canNext()}>Next</Button></div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Step 3: Pipeline Stages</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground mb-2">Customize your sales pipeline stages.</p>
            {stages.map((s, i) => (
              <div key={i} className="flex gap-2 items-center">
                <span className="text-xs text-muted-foreground w-5">{i + 1}.</span>
                <Input value={s.name} onChange={e => { const c = [...stages]; c[i] = { ...c[i], name: e.target.value }; setStages(c) }} className="flex-1" />
                <input type="color" value={s.color} onChange={e => { const c = [...stages]; c[i] = { ...c[i], color: e.target.value }; setStages(c) }} className="h-8 w-10 cursor-pointer border-0 p-0" />
                {stages.length > 2 && <Button variant="destructive" size="sm" onClick={() => setStages(s => s.filter((_, j) => j !== i))}>X</Button>}
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setStages(s => [...s, { name: '', color: '#888888' }])}>+ Add Stage</Button>
            <div className="flex gap-2 pt-2"><Button variant="outline" onClick={prev}>Back</Button><Button onClick={next} disabled={!canNext()}>Next</Button></div>
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Step 4: Subdomain</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">Choose a subdomain for this company&apos;s workspace.</p>
            <div className="flex items-center gap-1 text-sm flex-wrap">
              <span className="text-primary font-semibold">https://</span>
              <Input value={subdomain} onChange={e => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} placeholder="company-name" className="w-44 text-center font-semibold" />
              <span className="text-muted-foreground">.sandbox.localhost</span>
            </div>
            <div className="flex gap-2"><Button variant="outline" onClick={prev}>Back</Button><Button onClick={next} disabled={!canNext()}>Next</Button></div>
          </CardContent>
        </Card>
      )}

      {step === 5 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Step 5: Review & Deploy</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md bg-muted p-4 text-sm space-y-2">
              <div><strong>Company:</strong> {company.name}</div>
              <div><strong>Admin:</strong> {admin.email}</div>
              <div><strong>Pipeline:</strong> {stages.map(s => s.name).join(' → ')}</div>
              <div><strong>Domain:</strong> https://{subdomain}.sandbox.localhost</div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={prev}>Back</Button>
              <Button onClick={handleDeploy} disabled={deploying} className="bg-green-700 hover:bg-green-800">
                {deploying ? 'Deploying…' : 'Deploy Company'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
