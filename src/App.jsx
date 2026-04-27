import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BrowserRouter, Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import {
  addCost,
  addFlavor,
  addSlices,
  cancelOrder,
  changePasswordByPhone,
  clearStoredAuthToken,
  confirmOrderCash,
  createMercadoPagoPreference,
  createOrder,
  createPixPayment,
  createPosIntent,
  extractPixQrData,
  getCurrentUser,
  getPixQrCode,
  getStoredAuthToken,
  deleteCost,
  getCosts,
  getFlavors,
  getFinancials,
  getOrders,
  getPaymentIntentStatus,
  getReadyOrders,
  getStats,
  loginUser,
  markOrderReady,
  pickupOrder,
  setStoredAuthToken,
  signupUser,
  updateFlavor,
  uploadImage,
} from './api/backend'

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/sabores', label: 'Sabores e produtos' },
  { to: '/vender', label: 'Vender' },
  { to: '/cozinha', label: 'Cozinha' },
  { to: '/relatorio', label: 'Relatorio' },
]

function isAdminRole(role) {
  return String(role || '').toUpperCase() === 'ADMIN'
}

function getPaymentMethodLabel(order) {
  const method = order?.paymentMethod ?? order?.payment_method ?? ''
  if (method === 'point' || method === 'card') return '\u{1F4B3} Point'
  if (method === 'pix') return '\u{1F4F1} Pix'
  if (method === 'checkout_web' || method === 'mercadopago') return '\u{1F310} Checkout MP'
  if (method === 'dinheiro' || method === 'cash') return '\u{1F4B5} Dinheiro'
  return method || ''
}

function isPaymentMethodCash(order) {
  const method = order?.paymentMethod ?? order?.payment_method ?? ''
  return method === 'dinheiro' || method === 'cash'
}

function isPaymentMethodPix(order) {
  const method = order?.paymentMethod ?? order?.payment_method ?? ''
  return method === 'pix'
}

function isPaymentMethodCheckout(order) {
  const method = order?.paymentMethod ?? order?.payment_method ?? ''
  return method === 'checkout_web' || method === 'mercadopago'
}

function getOrderId(order) {
  return order?.id ?? order?.orderId ?? order?.order_id ?? null
}

function getOrderFlavorName(order) {
  return order?.flavorName ?? order?.flavor_name ?? ''
}

function getOrderFlavorQty(order) {
  const qty =
    order?.flavorQty ??
    order?.flavor_qty ??
    order?.qty ??
    order?.quantity ??
    1
  const parsed = Number(qty)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

function getOrderStatus(order) {
  return (
    order?.status ??
    order?.paymentStatus ??
    order?.payment_status ??
    order?.state ??
    ''
  )
}

function normalizeOrderStatus(order) {
  return String(getOrderStatus(order)).toLowerCase().trim()
}

function isWaitingPaymentStatus(status) {
  return (
    status === 'aguardando pagamento' ||
    status === 'pending' ||
    status === 'created' ||
    status === 'criado' ||
    status === 'in_process' ||
    status === 'em processamento'
  )
}

function isOrderPaid(order) {
  // Status de espera de pagamento (inclui pending) = nao pago; demais = pago
  const status = normalizeOrderStatus(order)
  return status !== '' && !isWaitingPaymentStatus(status)
}

// Backend retorna order.code diretamente como codigo de 3 digitos
function getPaymentCode(order) {
  const code = order?.code ?? order?.order_code ?? ''
  return code ? String(code) : ''
}

function parseCurrency(value) {
  if (typeof value === 'number') {
    return value
  }
  if (typeof value !== 'string') {
    return null
  }
  const cleaned = value
    .replace(/[^0-9,.-]/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
  const parsed = Number.parseFloat(cleaned)
  return Number.isNaN(parsed) ? null : parsed
}

function formatCurrency(value) {
  // Backend envia centavos (priceCents, totalCents) — converter para reais
  const num = typeof value === 'number' ? value / 100 : parseCurrency(value)
  if (typeof num === 'number' && !Number.isNaN(num)) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(num)
  }
  return '—'
}

function getOrderTotal(order) {
  // Backend retorna totalCents (inteiro em centavos)
  return (
    order?.totalCents ??
    order?.total_cents ??
    order?.total ??
    order?.totalAmount ??
    null
  )
}

function getFlavorId(flavor) {
  return flavor?.id ?? flavor?.flavorId ?? flavor?.flavor_id ?? null
}

function getFlavorName(flavor) {
  return flavor?.name ?? flavor?.flavorName ?? flavor?.flavor_name ?? ''
}

function getFlavorPrice(flavor) {
  // Backend retorna priceCents (inteiro em centavos)
  return flavor?.priceCents ?? flavor?.price_cents ?? null
}

function getFlavorSlices(flavor) {
  // Backend retorna slicesAvailable e slicesTotal
  const left =
    flavor?.slicesAvailable ??
    flavor?.slices_available ??
    null
  const total =
    flavor?.slicesTotal ??
    flavor?.slices_total ??
    null
  return { left, total }
}

function isFlavorActive(flavor) {
  if (typeof flavor?.active === 'boolean') return flavor.active
  if (typeof flavor?.enabled === 'boolean') return flavor.enabled
  const slices = getFlavorSlices(flavor)
  if (typeof slices.left === 'number') return slices.left > 0
  return true
}

function normalizeErrorMessage(error) {
  if (!error) {
    return 'Erro desconhecido'
  }
  if (typeof error === 'string') {
    return error
  }
  return error.message || 'Erro ao comunicar com o backend'
}

function formatPhone(value) {
  const numbers = String(value || '').replace(/\D/g, '').slice(0, 11)
  if (numbers.length <= 2) {
    return numbers ? `(${numbers}` : ''
  }
  if (numbers.length <= 6) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`
  }
  return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`
}

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '')
}

function validateLoginForm(data) {
  const errors = {}
  if (!data.username?.trim()) errors.username = 'Informe o usuário'
  if (!data.password) errors.password = 'Informe a senha'
  return Object.keys(errors).length ? errors : null
}

function validateSignupForm(data) {
  const errors = {}
  if (!data.username || data.username.length < 3 || data.username.length > 30) {
    errors.username = 'Username deve ter 3-30 caracteres'
  }
  if (!data.name || data.name.length < 2 || data.name.length > 100) {
    errors.name = 'Nome deve ter 2-100 caracteres'
  }
  if (!data.phone || !/^\d{10,11}$/.test(onlyDigits(data.phone))) {
    errors.phone = 'Telefone deve ter 10 ou 11 dígitos'
  }
  if (!data.password || data.password.length < 6) {
    errors.password = 'Senha deve ter no mínimo 6 caracteres'
  }
  if (data.password !== data.confirmPassword) {
    errors.confirmPassword = 'Senhas não conferem'
  }
  return Object.keys(errors).length ? errors : null
}

function validateChangePasswordForm(data) {
  const errors = {}
  if (!data.phone || !/^\d{10,11}$/.test(onlyDigits(data.phone))) {
    errors.phone = 'Telefone deve ter 10 ou 11 dígitos'
  }
  if (!data.newPassword || data.newPassword.length < 6) {
    errors.newPassword = 'Senha deve ter no mínimo 6 caracteres'
  }
  if (data.newPassword !== data.confirmPassword) {
    errors.confirmPassword = 'Senhas não conferem'
  }
  return Object.keys(errors).length ? errors : null
}

const PIX_STORAGE_KEY = 'forninho_pix_state_v1'

const PixQrPanel = memo(function PixQrPanel({ pixState, onCopy, copied }) {
  if (!pixState?.qrCodeBase64) return null

  return (
    <div className="mt-2 rounded-xl border border-[rgba(123,78,43,0.2)] bg-white/60 p-3">
      <p className="text-xs uppercase tracking-[0.15em] text-espresso/50">Pagamento PIX</p>
      <img
        src={`data:image/png;base64,${pixState.qrCodeBase64}`}
        alt="QR Code PIX"
        className="mt-2 h-40 w-40 rounded-lg border border-[rgba(123,78,43,0.15)] bg-white p-1"
      />
      <div className="mt-2 flex items-center gap-2">
        <button className="ghost-button small" type="button" onClick={onCopy}>
          {copied ? '✓ Copiado!' : 'Copiar codigo PIX'}
        </button>
        <p className="text-xs text-espresso/60">
          Expira em ~{Math.max(1, Math.floor((pixState.expiresIn ?? 1800) / 60))} min
        </p>
      </div>
    </div>
  )
})

function useOrdersData(enabled = true) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadOrders = useCallback(async (showLoading = true) => {
    if (!enabled) {
      setOrders([])
      setError('')
      setLoading(false)
      return
    }
    try {
      if (showLoading) setLoading(true)
      setError('')
      const data = await getOrders()
      const items = Array.isArray(data) ? data : data?.orders
      setOrders(Array.isArray(items) ? items : [])
    } catch (err) {
      setError(normalizeErrorMessage(err))
      setOrders([])
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  return { orders, loading, error, reload: loadOrders }
}

function useReadyOrders(enabled = true) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadReadyOrders = useCallback(async (showLoading = true) => {
    if (!enabled) {
      setOrders([])
      setError('')
      setLoading(false)
      return
    }
    try {
      if (showLoading) setLoading(true)
      setError('')
      const data = await getReadyOrders()
      const items = Array.isArray(data) ? data : data?.orders
      setOrders(Array.isArray(items) ? items : [])
    } catch (err) {
      setError(normalizeErrorMessage(err))
      setOrders([])
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return undefined
    loadReadyOrders()
    const interval = setInterval(() => loadReadyOrders(false), 5000)
    return () => clearInterval(interval)
  }, [enabled, loadReadyOrders])

  return { orders, loading, error, reload: loadReadyOrders }
}

function useFlavors() {
  const [flavors, setFlavors] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadFlavors = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const data = await getFlavors()
      const items = Array.isArray(data) ? data : (data?.flavors ?? data?.products)
      setFlavors(Array.isArray(items) ? items : [])
    } catch (err) {
      setError(normalizeErrorMessage(err))
      setFlavors([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadFlavors()
  }, [loadFlavors])

  return { flavors, loading, error, reload: loadFlavors }
}

function useFinancials(enabled = true) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!enabled) {
      setData(null)
      setError('')
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      setError('')
      const result = await getFinancials()
      setData(result)
    } catch (err) {
      setError(normalizeErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => { load() }, [load])
  return { data, loading, error, reload: load }
}

function useStats(enabled = true) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!enabled) {
      setData(null)
      setError('')
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      setError('')
      const result = await getStats()
      setData(result)
    } catch (err) {
      setError(normalizeErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => { load() }, [load])
  return { data, loading, error, reload: load }
}

function useCosts(enabled = true) {
  const [costs, setCosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!enabled) {
      setCosts([])
      setError('')
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      setError('')
      const result = await getCosts()
      setCosts(Array.isArray(result) ? result : [])
    } catch (err) {
      setError(normalizeErrorMessage(err))
      setCosts([])
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => { load() }, [load])
  return { costs, loading, error, reload: load }
}

function AuthPanel({ title, description, children, footer }) {
  return (
    <div className="min-h-screen bg-app px-6 py-10">
      <div className="mx-auto w-full max-w-md card">
        <div className="space-y-2">
          <p className="pill pill-outline w-fit">Forninho Mágico</p>
          <h1 className="section-title">{title}</h1>
          <p className="section-sub">{description}</p>
        </div>
        {children}
        {footer}
      </div>
    </div>
  )
}

function LoginPage({ onLogin, loading, error }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})

  const nextPath = new URLSearchParams(location.search).get('next') || '/'

  const handleSubmit = async (e) => {
    e.preventDefault()
    const validation = validateLoginForm({ username, password })
    if (validation) {
      setFieldErrors(validation)
      return
    }
    setFieldErrors({})
    const ok = await onLogin({ username: username.trim(), password, nextPath })
    if (ok) navigate(nextPath, { replace: true })
  }

  return (
    <AuthPanel
      title="Entrar"
      description="Faça login para acessar o dashboard interno."
      footer={(
        <div className="mt-6 flex flex-col gap-2 text-sm text-espresso/70">
          <Link className="ghost-button small text-center" to="/signup">Criar nova conta</Link>
          <Link className="ghost-button small text-center" to="/change-password">Esqueci minha senha</Link>
        </div>
      )}
    >
      <form onSubmit={handleSubmit} className="mt-6 grid gap-3">
        <label className="field">
          <span>Username</span>
          <input value={username} onChange={(e) => setUsername(e.target.value)} type="text" />
          {fieldErrors.username && <small className="text-xs text-espresso/70">{fieldErrors.username}</small>}
        </label>
        <label className="field">
          <span>Password</span>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" />
          {fieldErrors.password && <small className="text-xs text-espresso/70">{fieldErrors.password}</small>}
        </label>
        {error && <p className="text-sm text-espresso/70">{error}</p>}
        <button className="primary-button" type="submit" disabled={loading}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </AuthPanel>
  )
}

function SignupPage({ onSignup, loading, error }) {
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', name: '', phone: '', password: '', confirmPassword: '' })
  const [fieldErrors, setFieldErrors] = useState({})

  const handleSubmit = async (e) => {
    e.preventDefault()
    const validation = validateSignupForm(form)
    if (validation) {
      setFieldErrors(validation)
      return
    }
    setFieldErrors({})
    const ok = await onSignup({ ...form })
    if (ok) navigate('/', { replace: true })
  }

  return (
    <AuthPanel
      title="Criar nova conta"
      description="Cadastre um novo usuário com telefone validado."
      footer={(
        <div className="mt-6 flex flex-col gap-2 text-sm text-espresso/70">
          <Link className="ghost-button small text-center" to="/login">Já tenho conta, fazer login</Link>
          <Link className="ghost-button small text-center" to="/change-password">Esqueci minha senha</Link>
        </div>
      )}
    >
      <form onSubmit={handleSubmit} className="mt-6 grid gap-3">
        <label className="field">
          <span>Username</span>
          <input value={form.username} onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))} type="text" />
          {fieldErrors.username && <small className="text-xs text-espresso/70">{fieldErrors.username}</small>}
        </label>
        <label className="field">
          <span>Nome Completo</span>
          <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} type="text" />
          {fieldErrors.name && <small className="text-xs text-espresso/70">{fieldErrors.name}</small>}
        </label>
        <label className="field">
          <span>Telefone</span>
          <input
            value={form.phone}
            onChange={(e) => setForm((p) => ({ ...p, phone: formatPhone(e.target.value) }))}
            type="text"
            inputMode="numeric"
            placeholder="(11) 98765-4321"
          />
          {fieldErrors.phone && <small className="text-xs text-espresso/70">{fieldErrors.phone}</small>}
        </label>
        <label className="field">
          <span>Senha</span>
          <input value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} type="password" />
          {fieldErrors.password && <small className="text-xs text-espresso/70">{fieldErrors.password}</small>}
        </label>
        <label className="field">
          <span>Confirmar Senha</span>
          <input value={form.confirmPassword} onChange={(e) => setForm((p) => ({ ...p, confirmPassword: e.target.value }))} type="password" />
          {fieldErrors.confirmPassword && <small className="text-xs text-espresso/70">{fieldErrors.confirmPassword}</small>}
        </label>
        {error && <p className="text-sm text-espresso/70">{error}</p>}
        <button className="primary-button" type="submit" disabled={loading}>
          {loading ? 'Cadastrando...' : 'Cadastrar'}
        </button>
      </form>
    </AuthPanel>
  )
}

function ChangePasswordPage({ onChangePassword, loading, error }) {
  const navigate = useNavigate()
  const [form, setForm] = useState({ phone: '', newPassword: '', confirmPassword: '' })
  const [fieldErrors, setFieldErrors] = useState({})

  const handleSubmit = async (e) => {
    e.preventDefault()
    const validation = validateChangePasswordForm(form)
    if (validation) {
      setFieldErrors(validation)
      return
    }
    setFieldErrors({})
    const ok = await onChangePassword({ ...form })
    if (ok) navigate('/', { replace: true })
  }

  return (
    <AuthPanel
      title="Alterar senha"
      description="Recupere o acesso usando o telefone cadastrado."
      footer={(
        <div className="mt-6 flex flex-col gap-2 text-sm text-espresso/70">
          <Link className="ghost-button small text-center" to="/login">Voltar ao login</Link>
          <Link className="ghost-button small text-center" to="/signup">Criar nova conta</Link>
        </div>
      )}
    >
      <form onSubmit={handleSubmit} className="mt-6 grid gap-3">
        <label className="field">
          <span>Telefone</span>
          <input
            value={form.phone}
            onChange={(e) => setForm((p) => ({ ...p, phone: formatPhone(e.target.value) }))}
            type="text"
            inputMode="numeric"
            placeholder="(11) 98765-4321"
          />
          {fieldErrors.phone && <small className="text-xs text-espresso/70">{fieldErrors.phone}</small>}
        </label>
        <label className="field">
          <span>Nova Senha</span>
          <input value={form.newPassword} onChange={(e) => setForm((p) => ({ ...p, newPassword: e.target.value }))} type="password" />
          {fieldErrors.newPassword && <small className="text-xs text-espresso/70">{fieldErrors.newPassword}</small>}
        </label>
        <label className="field">
          <span>Confirmar Senha</span>
          <input value={form.confirmPassword} onChange={(e) => setForm((p) => ({ ...p, confirmPassword: e.target.value }))} type="password" />
          {fieldErrors.confirmPassword && <small className="text-xs text-espresso/70">{fieldErrors.confirmPassword}</small>}
        </label>
        {error && <p className="text-sm text-espresso/70">{error}</p>}
        <button className="primary-button" type="submit" disabled={loading}>
          {loading ? 'Alterando...' : 'Alterar Senha'}
        </button>
      </form>
    </AuthPanel>
  )
}

function DashboardPage({ stats, loadingStats, errorStats, flavors, loadingFlavors, canViewStats, onShareTracking }) {
  return (
    <section className="flex flex-col gap-8 animate-fade-in">
      <header className="card">
        <div className="flex flex-wrap items-center gap-3">
          <span className="pill">PRAÇA DA TOCO</span>
          <span className="pill pill-dark">Vendas presenciais</span>
          <span className="pill pill-outline">Mercado Pago</span>
        </div>
        <div className="mt-6">
          <h1 className="text-balance text-4xl font-display uppercase tracking-[0.12em] text-espresso sm:text-5xl">
            Forninho Mágico da Ana
          </h1>
          <p className="mt-4 max-w-xl text-base text-espresso/70">
            {canViewStats
              ? 'Dashboard para vendas, estoque de fatias e controle de lucro.'
              : 'Catálogo de sabores e acompanhamento de pedidos prontos.'}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <NavLink className="ghost-button" to="/acompanhamento">
              Abrir acompanhamento
            </NavLink>
            <button className="ghost-button" type="button" onClick={onShareTracking}>
              Compartilhar acompanhamento
            </button>
          </div>
        </div>
      </header>
      {canViewStats && errorStats && (
        <div className="card">
          <p className="text-sm text-espresso/70">{errorStats}</p>
        </div>
      )}
      {canViewStats && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="stat-card">
            <p className="stat-label">Total de pedidos</p>
            <p className="stat-value">
              {loadingStats ? 'Carregando...' : (stats?.totalOrders ?? '—')}
            </p>
            <p className="stat-sub">Exclui cancelados</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">Pedidos pagos</p>
            <p className="stat-value">
              {loadingStats ? 'Carregando...' : (stats?.paidOrders ?? '—')}
            </p>
            <p className="stat-sub">Status confirmado no backend</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">Aguardando pagamento</p>
            <p className="stat-value">
              {loadingStats ? 'Carregando...' : (stats?.pendingOrders ?? '—')}
            </p>
            <p className="stat-sub">
              {stats?.cancelledOrders != null ? `${stats.cancelledOrders} cancelado(s)` : 'Pagamento pendente'}
            </p>
          </div>
        </div>
      )}
      <div className="card">
        <h2 className="section-title">Sabores disponíveis</h2>
        <p className="section-sub">Fatias disponíveis por sabor.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {loadingFlavors && <p className="text-sm text-espresso/70">Carregando...</p>}
          {!loadingFlavors && flavors.length === 0 && (
            <p className="text-sm text-espresso/70">Nenhum sabor cadastrado.</p>
          )}
          {flavors.map((flavor) => {
            const flavorId = getFlavorId(flavor)
            const name = getFlavorName(flavor)
            const price = getFlavorPrice(flavor)
            const slices = getFlavorSlices(flavor)
            const active = isFlavorActive(flavor)
            const imageUrl = flavor?.imageUrl ?? null
            return (
              <div key={flavorId ?? name} className="overflow-hidden rounded-2xl border border-[rgba(123,78,43,0.15)] bg-white/60">
                <div className="flex h-36 items-center justify-center overflow-hidden bg-[rgba(229,200,169,0.25)]">
                  {imageUrl ? (
                    <img src={imageUrl} alt={name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-5xl">🎂</span>
                  )}
                </div>
                <div className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-espresso">{name}</p>
                    {!active && <span className="pill pill-small pill-outline">Pausado</span>}
                  </div>
                  <p className="mt-1 text-xs text-espresso/60">
                    {price !== null ? formatCurrency(price) + ' por fatia' : '—'}
                    {slices.left !== null ? ` · ${slices.left} disponíveis` : ''}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function FlavorsPage({ flavors, loading, error, reloadFlavors, canManageFlavors }) {
  const [showNewFlavor, setShowNewFlavor] = useState(false)
  const [newFlavor, setNewFlavor] = useState({ name: '', price: '', slicesTotal: '' })
  const [newFlavorImageFile, setNewFlavorImageFile] = useState(null)
  const [newFlavorPreview, setNewFlavorPreview] = useState('')
  const [savingFlavor, setSavingFlavor] = useState(false)
  const [flavorFormError, setFlavorFormError] = useState('')

  const [addingSlicesFor, setAddingSlicesFor] = useState(null)
  const [slicesQty, setSlicesQty] = useState(1)
  const [savingSlices, setSavingSlices] = useState(false)
  const [slicesErrors, setSlicesErrors] = useState({})

  const [editingImageFor, setEditingImageFor] = useState(null)
  const [editImageFile, setEditImageFile] = useState(null)
  const [editImagePreview, setEditImagePreview] = useState('')
  const [savingImage, setSavingImage] = useState(false)
  const [imageErrors, setImageErrors] = useState({})

  const handleNewFlavorImage = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (newFlavorPreview) URL.revokeObjectURL(newFlavorPreview)
    setNewFlavorImageFile(file)
    setNewFlavorPreview(URL.createObjectURL(file))
  }

  const handleEditImage = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (editImagePreview) URL.revokeObjectURL(editImagePreview)
    setEditImageFile(file)
    setEditImagePreview(URL.createObjectURL(file))
  }

  const handleSaveFlavor = async (e) => {
    e.preventDefault()
    if (!newFlavor.name.trim()) return
    const price = parseCurrency(newFlavor.price)
    if (price === null || price <= 0) {
      setFlavorFormError('Informe um preco valido (ex: 12,50)')
      return
    }
    try {
      setSavingFlavor(true)
      setFlavorFormError('')
      let imageUrl
      if (newFlavorImageFile) {
        const result = await uploadImage(newFlavorImageFile)
        imageUrl = result?.url ?? result?.imageUrl
      }
      await addFlavor({
        name: newFlavor.name.trim(),
        price,
        slicesTotal: Number(newFlavor.slicesTotal) || 0,
        imageUrl,
      })
      if (newFlavorPreview) URL.revokeObjectURL(newFlavorPreview)
      setNewFlavor({ name: '', price: '', slicesTotal: '' })
      setNewFlavorImageFile(null)
      setNewFlavorPreview('')
      setShowNewFlavor(false)
      await reloadFlavors()
    } catch (err) {
      setFlavorFormError(normalizeErrorMessage(err))
    } finally {
      setSavingFlavor(false)
    }
  }

  const handleAddSlices = async (flavorId) => {
    try {
      setSavingSlices(true)
      setSlicesErrors((prev) => ({ ...prev, [flavorId]: '' }))
      await addSlices(flavorId, Number(slicesQty))
      setAddingSlicesFor(null)
      setSlicesQty(1)
      await reloadFlavors()
    } catch (err) {
      setSlicesErrors((prev) => ({ ...prev, [flavorId]: normalizeErrorMessage(err) }))
    } finally {
      setSavingSlices(false)
    }
  }

  const handleSaveImage = async (flavorId) => {
    if (!editImageFile) return
    try {
      setSavingImage(true)
      setImageErrors((prev) => ({ ...prev, [flavorId]: '' }))
      const result = await uploadImage(editImageFile)
      const url = result?.url ?? result?.imageUrl
      await updateFlavor(flavorId, { imageUrl: url })
      if (editImagePreview) URL.revokeObjectURL(editImagePreview)
      setEditingImageFor(null)
      setEditImageFile(null)
      setEditImagePreview('')
      await reloadFlavors()
    } catch (err) {
      setImageErrors((prev) => ({ ...prev, [flavorId]: normalizeErrorMessage(err) }))
    } finally {
      setSavingImage(false)
    }
  }

  return (
    <section className="grid gap-8 animate-fade-in">
      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="section-title">Sabores e produtos</h2>
            <p className="section-sub">
              {canManageFlavors
                ? 'Controle a quantidade de fatias disponiveis por sabor.'
                : 'Visualização dos sabores disponíveis.'}
            </p>
          </div>
          {canManageFlavors && (
            <button
              className="ghost-button"
              type="button"
              onClick={() => { setShowNewFlavor((v) => !v); setFlavorFormError('') }}
            >
              {showNewFlavor ? 'Cancelar' : 'Cadastrar sabor'}
            </button>
          )}
        </div>

        {canManageFlavors && showNewFlavor && (
          <form onSubmit={handleSaveFlavor} className="mt-6 grid gap-4 rounded-2xl border border-[rgba(123,78,43,0.2)] bg-white/60 p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-espresso/50">Novo sabor</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="field">
                <span>Nome do sabor</span>
                <input
                  type="text"
                  required
                  value={newFlavor.name}
                  onChange={(e) => setNewFlavor((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Brigadeiro da Casa"
                />
              </label>
              <label className="field">
                <span>Preco por fatia (R$)</span>
                <input
                  type="text"
                  value={newFlavor.price}
                  onChange={(e) => setNewFlavor((prev) => ({ ...prev, price: e.target.value }))}
                  placeholder="Ex: 12,00"
                />
              </label>
              <label className="field">
                <span>Total de fatias</span>
                <input
                  type="number"
                  min="0"
                  value={newFlavor.slicesTotal}
                  onChange={(e) => setNewFlavor((prev) => ({ ...prev, slicesTotal: e.target.value }))}
                  placeholder="Ex: 30"
                />
              </label>
            </div>
            <label className="field">
              <span>Imagem do sabor (opcional)</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleNewFlavorImage}
              />
              {newFlavorPreview && (
                <img src={newFlavorPreview} alt="preview" className="mt-2 h-24 w-24 rounded-xl object-cover" />
              )}
            </label>
            {flavorFormError && (
              <p className="text-xs text-espresso/70">{flavorFormError}</p>
            )}
            <div className="flex justify-end">
              <button className="primary-button" type="submit" disabled={savingFlavor}>
                {savingFlavor ? 'Salvando...' : 'Salvar sabor'}
              </button>
            </div>
          </form>
        )}

        {error && !loading && (
          <p className="mt-6 text-sm text-espresso/70">{error}</p>
        )}

        <div className="mt-6 space-y-4">
          {loading && <p className="text-sm text-espresso/70">Carregando...</p>}
          {!loading && flavors.length === 0 && (
            <p className="text-sm text-espresso/70">
              Nenhum sabor cadastrado. Use o botao acima para adicionar.
            </p>
          )}
          {flavors.map((flavor) => {
            const flavorId = getFlavorId(flavor)
            const name = getFlavorName(flavor)
            const price = getFlavorPrice(flavor)
            const slices = getFlavorSlices(flavor)
            const active = isFlavorActive(flavor)
            const isAddingHere = addingSlicesFor === flavorId
            const isEditingImage = editingImageFor === flavorId
            const currentImageUrl = flavor?.imageUrl ?? null

            return (
              <div key={flavorId ?? name} className="soft-card">
                <div className="flex items-start gap-4">
                  {/* thumbnail */}
                  <div
                    className={`flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[rgba(123,78,43,0.15)] bg-[rgba(229,200,169,0.25)] ${canManageFlavors ? 'cursor-pointer' : ''}`}
                    title={canManageFlavors ? 'Clique para alterar imagem' : ''}
                    onClick={() => {
                      if (!canManageFlavors) return
                      if (isEditingImage) {
                        if (editImagePreview) URL.revokeObjectURL(editImagePreview)
                        setEditingImageFor(null)
                        setEditImageFile(null)
                        setEditImagePreview('')
                      } else {
                        setEditingImageFor(flavorId)
                        setEditImageFile(null)
                        setEditImagePreview('')
                      }
                    }}
                  >
                    {currentImageUrl ? (
                      <img src={currentImageUrl} alt={name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-2xl">🎂</span>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-espresso">{name}</h3>
                      <span className={`pill pill-small ${active ? 'pill-dark' : 'pill-outline'}`}>
                        {active ? 'Ativo' : 'Pausado'}
                      </span>
                    </div>
                    <p className="text-sm text-espresso/60">
                      {price !== null ? `${formatCurrency(price)} por fatia` : 'Sem preco cadastrado'}
                    </p>
                    {slicesErrors[flavorId] && (
                      <p className="text-xs text-espresso/70 mt-1">{slicesErrors[flavorId]}</p>
                    )}
                  </div>
                </div>

                {/* Formulario de editar imagem */}
                {canManageFlavors && isEditingImage && (
                  <div className="mt-3 flex flex-col gap-2 rounded-xl border border-[rgba(123,78,43,0.2)] bg-white/60 p-3">
                    <p className="text-xs uppercase tracking-[0.15em] text-espresso/50">Nova imagem</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="file"
                        accept="image/*"
                        className="flex-1 text-sm text-espresso"
                        onChange={handleEditImage}
                        autoFocus
                      />
                      <button
                        className="ghost-button small"
                        type="button"
                        onClick={() => handleSaveImage(flavorId)}
                        disabled={savingImage || !editImageFile}
                      >
                        {savingImage ? 'Enviando...' : 'Salvar'}
                      </button>
                      <button
                        className="ghost-button small"
                        type="button"
                        onClick={() => {
                          if (editImagePreview) URL.revokeObjectURL(editImagePreview)
                          setEditingImageFor(null)
                          setEditImageFile(null)
                          setEditImagePreview('')
                        }}
                      >
                        Cancelar
                      </button>
                    </div>
                    {editImagePreview && (
                      <img src={editImagePreview} alt="preview" className="h-24 w-24 rounded-xl object-cover" />
                    )}
                    {imageErrors[flavorId] && (
                      <p className="text-xs text-espresso/70">{imageErrors[flavorId]}</p>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-4">
                  {slices.left !== null && (
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-espresso/50">Estoque</p>
                      <p className="text-base font-semibold text-espresso">
                        {slices.left}{slices.total !== null ? ` / ${slices.total}` : ''}
                      </p>
                    </div>
                  )}
                  {canManageFlavors && isAddingHere ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        value={slicesQty}
                        onChange={(e) => setSlicesQty(e.target.value)}
                        className="w-20 rounded-xl border border-[rgba(123,78,43,0.2)] bg-[#fffdf9] px-3 py-2 text-sm text-espresso"
                      />
                      <button
                        className="ghost-button small"
                        type="button"
                        onClick={() => handleAddSlices(flavorId)}
                        disabled={savingSlices}
                      >
                        {savingSlices ? '...' : 'Confirmar'}
                      </button>
                      <button
                        className="ghost-button small"
                        type="button"
                        onClick={() => { setAddingSlicesFor(null); setSlicesQty(1) }}
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : canManageFlavors ? (
                    <button
                      className="ghost-button small"
                      type="button"
                      onClick={() => { setAddingSlicesFor(flavorId); setSlicesQty(1) }}
                    >
                      Adicionar fatias
                    </button>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function SalesPage({ orders, loading, error, flavors, reloadOrders, reloadReadyOrders }) {
  const [items, setItems] = useState([{ id: Date.now(), flavorId: '', qty: 1 }])
  const [paymentMethod, setPaymentMethod] = useState('point')
  const [customerName, setCustomerName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitFeedback, setSubmitFeedback] = useState(null)

  const [sendingOrderId, setSendingOrderId] = useState(null)
  const pollingIntervalsRef = useRef({})
  const [pixStateByOrder, setPixStateByOrder] = useState(() => {
    try {
      const raw = localStorage.getItem(PIX_STORAGE_KEY)
      if (!raw) return {}
      const parsed = JSON.parse(raw)
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return {}
    }
  })
  // Ref sempre atualizado com o valor corrente — evita closures stale em effects
  const pixStateByOrderRef = useRef(pixStateByOrder)
  const [copyingOrderId, setCopyingOrderId] = useState(null)
  const [cancelingOrderId, setCancelingOrderId] = useState(null)
  const [checkingOutOrderId, setCheckingOutOrderId] = useState(null)
  const [actionFeedback, setActionFeedback] = useState({})
  const checkoutPollingRef = useRef({})
  const pixQrLookupBlockedRef = useRef({})
  const pixQrLookupInFlightRef = useRef({})

  // Mantém a ref sincronizada (fallback para renderizações normais)
  useEffect(() => {
    pixStateByOrderRef.current = pixStateByOrder
    localStorage.setItem(PIX_STORAGE_KEY, JSON.stringify(pixStateByOrder))
  }, [pixStateByOrder])

  // IMPORTANTE: atualiza ref IMEDIATAMENTE (síncrono, antes de qualquer await),
  // depois agenda o update do estado React para re-render.
  const updatePixState = useCallback((updaterOrValue) => {
    const next =
      typeof updaterOrValue === 'function'
        ? updaterOrValue(pixStateByOrderRef.current)
        : updaterOrValue
    pixStateByOrderRef.current = next
    localStorage.setItem(PIX_STORAGE_KEY, JSON.stringify(next))
    setPixStateByOrder(next)
  }, [])

  useEffect(() => {
    return () => {
      Object.values(pollingIntervalsRef.current).forEach((intervalId) => clearInterval(intervalId))
      pollingIntervalsRef.current = {}
      Object.values(checkoutPollingRef.current).forEach((intervalId) => clearInterval(intervalId))
      checkoutPollingRef.current = {}
    }
  }, [])

  const activePixOrderIds = useMemo(() => Object.keys(pixStateByOrder), [pixStateByOrder])

  const PAID_STATUSES = useMemo(
    () => new Set(['em montagem', 'pronto', 'retirado', 'cancelado', 'paid', 'pago', 'concluido', 'concluído']),
    []
  )

  useEffect(() => {
    if (orders.length === 0) return
    updatePixState((prev) => {
      const next = { ...prev }
      let changed = false
      for (const order of orders) {
        const orderId = getOrderId(order)
        if (!orderId || !next[orderId]) continue
        const status = String(getOrderStatus(order)).toLowerCase().trim()
        // Só remove o QR quando o status indica claramente que o pedido foi pago/processado
        if (status && PAID_STATUSES.has(status)) {
          delete next[orderId]
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [orders, PAID_STATUSES, updatePixState])

  // Auto-recuperação: usa a REF para checar estado atual (evita closure stale)
  useEffect(() => {
    const pixOrders = orders.filter(
      (o) => isPaymentMethodPix(o) && isWaitingPaymentStatus(normalizeOrderStatus(o))
    )
    for (const order of pixOrders) {
      const orderId = getOrderId(order)
      // Usa ref para ver o estado ATUAL, não o do closure
      if (!orderId || pixStateByOrderRef.current[orderId]) continue
      if (pixQrLookupBlockedRef.current[orderId]) continue
      if (pixQrLookupInFlightRef.current[orderId]) continue

      pixQrLookupInFlightRef.current[orderId] = true
      getPixQrCode(orderId)
        .then((data) => {
          console.log('[PIX] getPixQrCode resposta:', JSON.stringify(data))
          // Backend pode retornar paid:true com status:"pending" incorretamente.
          // Considera não-pago se status ainda for pending/aguardando ou se tiver qrCodeBase64
          const backendStatusIsPending =
            data?.status === 'pending' || data?.status === 'aguardando pagamento'
          const isActuallyPaid = data?.paid && !backendStatusIsPending
          if (data && !isActuallyPaid) {
            const extracted = extractPixQrData(data)
            if (extracted.qrCodeBase64) {
              delete pixQrLookupBlockedRef.current[orderId]
              updatePixState((prev) => ({ ...prev, [orderId]: extracted }))
            }
          }
        })
        .catch((err) => {
          // Se o backend não tem QR para esse pedido, evita ficar repetindo 404 em loop.
          if (err?.status === 404) {
            pixQrLookupBlockedRef.current[orderId] = true
          }
        })
        .finally(() => {
          delete pixQrLookupInFlightRef.current[orderId]
        })
    }
  }, [orders, updatePixState])

  useEffect(() => {
    if (activePixOrderIds.length === 0) return undefined
    const intervalId = setInterval(async () => {
      await reloadOrders(false)
      await reloadReadyOrders(false)
    }, 3000)
    return () => clearInterval(intervalId)
  }, [activePixOrderIds.length, reloadOrders, reloadReadyOrders])

  const addItem = () => {
    setItems((prev) => [...prev, { id: Date.now(), flavorId: '', qty: 1 }])
  }

  const removeItem = (id) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }

  const updateItem = (id, field, value) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    )
  }

  const estimatedTotal = useMemo(() => {
    let sumCents = 0
    for (const item of items) {
      const flavor = flavors.find((f) => String(getFlavorId(f)) === String(item.flavorId))
      // priceCents já é inteiro em centavos
      const priceCents = flavor ? (getFlavorPrice(flavor) ?? 0) : 0
      if (priceCents > 0 && item.qty > 0) {
        sumCents += priceCents * Number(item.qty)
      }
    }
    return sumCents > 0 ? sumCents : null
  }, [items, flavors])

  const handleSubmitSale = async (e) => {
    e.preventDefault()
    const validItems = items.filter((item) => item.flavorId && Number(item.qty) > 0)
    if (validItems.length === 0) {
      setSubmitFeedback({ type: 'error', message: 'Selecione ao menos um sabor.' })
      return
    }
    if (paymentMethod === 'checkout_web' && validItems.length > 1) {
      setSubmitFeedback({ type: 'error', message: 'Checkout Web suporta 1 item por pedido nesta tela.' })
      return
    }
    try {
      setSubmitting(true)
      setSubmitFeedback(null)
      // Backend cria um pedido por item — criar em sequencia
      const createdOrders = []
      const trimmedName = customerName.trim() || undefined
      for (const item of validItems) {
        const order = await createOrder({
          flavorId: item.flavorId,
          qty: Number(item.qty),
          paymentMethod,
          customerName: trimmedName,
        })
        createdOrders.push(order)
      }
      if (paymentMethod === 'pix') {
        const generated = {}
        for (const order of createdOrders) {
          const orderId = getOrderId(order)
          if (!orderId) continue
          setActionFeedback((prev) => ({
            ...prev,
            [orderId]: { type: 'info', message: 'Gerando QR Code PIX...' },
          }))
          const pixData = await createPixPayment(orderId)
          console.log('[PIX] createPixPayment resposta:', JSON.stringify(pixData))
          const extracted = extractPixQrData(pixData)
          console.log('[PIX] campos extraídos:', extracted)
          generated[orderId] = extracted
          if (!extracted.qrCodeBase64) {
            setActionFeedback((prev) => ({
              ...prev,
              [orderId]: { type: 'error', message: 'QR PIX gerado mas imagem vazia. Verifique o console.' },
            }))
          } else {
            setActionFeedback((prev) => ({
              ...prev,
              [orderId]: { type: 'info', message: 'Aguardando pagamento via PIX...' },
            }))
          }
        }
        updatePixState((prev) => ({ ...prev, ...generated }))
      }
      if (paymentMethod === 'point' || paymentMethod === 'card') {
        for (const order of createdOrders) {
          const orderId = getOrderId(order)
          if (orderId) {
            await createPosIntent(orderId)
          }
        }
        setSubmitFeedback({ type: 'success', message: 'Aguardando pagamento na maquininha...' })
      } else if (paymentMethod === 'checkout_web') {
        const firstOrderId = getOrderId(createdOrders[0])
        if (firstOrderId) {
          const pref = await createMercadoPagoPreference(firstOrderId)
          const initPoint = pref?.initPoint ?? pref?.sandboxInitPoint
          if (!initPoint) {
            throw new Error('Checkout sem URL de pagamento.')
          }
          window.open(initPoint, '_blank', 'noopener,noreferrer')
          setActionFeedback((prev) => ({
            ...prev,
            [firstOrderId]: { type: 'info', message: 'Checkout aberto. Aguardando confirmação...' },
          }))
        }
        setSubmitFeedback({ type: 'success', message: 'Checkout Mercado Pago aberto em nova aba.' })
      } else if (paymentMethod === 'pix') {
        setSubmitFeedback({ type: 'success', message: 'QR Code PIX gerado. Aguardando pagamento...' })
      } else {
        // dinheiro — confirmar direto
        for (const order of createdOrders) {
          const orderId = getOrderId(order)
          if (orderId) {
            await confirmOrderCash(orderId)
          }
        }
        const count = createdOrders.length
        setSubmitFeedback({ type: 'success', message: `${count > 1 ? `${count} pedidos criados` : 'Pedido criado'} com sucesso!` })
      }
      setItems([{ id: Date.now(), flavorId: '', qty: 1 }])
      setCustomerName('')
      await reloadOrders()
      await reloadReadyOrders()
    } catch (err) {
      setSubmitFeedback({ type: 'error', message: normalizeErrorMessage(err) })
    } finally {
      setSubmitting(false)
    }
  }

  const handleSendToPos = async (orderId) => {
    try {
      setSendingOrderId(orderId)
      setActionFeedback((prev) => ({
        ...prev,
        [orderId]: { type: 'info', message: 'Enviando para maquininha...' },
      }))
      await createPosIntent(orderId)
      setActionFeedback((prev) => ({
        ...prev,
        [orderId]: { type: 'info', message: 'Confirme o pagamento na máquina...' },
      }))
      pollPaymentStatus(orderId)
      await reloadOrders()
      await reloadReadyOrders()
    } catch (err) {
      setActionFeedback((prev) => ({
        ...prev,
        [orderId]: { type: 'error', message: normalizeErrorMessage(err) },
      }))
    } finally {
      setSendingOrderId(null)
    }
  }

  const handleGeneratePix = async (orderId) => {
    try {
      setSendingOrderId(orderId)
      setActionFeedback((prev) => ({
        ...prev,
        [orderId]: { type: 'info', message: 'Gerando QR Code PIX...' },
      }))
      const pixData = await createPixPayment(orderId)
      console.log('[PIX] handleGeneratePix resposta:', JSON.stringify(pixData))
      const extracted = extractPixQrData(pixData)
      console.log('[PIX] campos extraídos:', extracted)
      updatePixState((prev) => ({ ...prev, [orderId]: extracted }))
      if (!extracted.qrCodeBase64) {
        setActionFeedback((prev) => ({
          ...prev,
          [orderId]: { type: 'error', message: 'QR PIX sem imagem. Verifique o console (F12).' },
        }))
      } else {
        setActionFeedback((prev) => ({
          ...prev,
          [orderId]: { type: 'info', message: 'Aguardando pagamento via PIX...' },
        }))
      }
      await reloadOrders()
    } catch (err) {
      setActionFeedback((prev) => ({
        ...prev,
        [orderId]: { type: 'error', message: normalizeErrorMessage(err) },
      }))
    } finally {
      setSendingOrderId(null)
    }
  }

  const pollCheckoutStatus = (orderId) => {
    let attempts = 0
    const maxAttempts = 100

    if (checkoutPollingRef.current[orderId]) {
      clearInterval(checkoutPollingRef.current[orderId])
    }

    const interval = setInterval(async () => {
      attempts++
      if (attempts > maxAttempts) {
        clearInterval(interval)
        delete checkoutPollingRef.current[orderId]
        return
      }
      try {
        const data = await getOrders()
        const items = Array.isArray(data) ? data : data?.orders
        const found = Array.isArray(items)
          ? items.find((o) => String(getOrderId(o)) === String(orderId))
          : null
        const status = String(getOrderStatus(found)).toLowerCase()
        if (status && status !== 'aguardando pagamento' && status !== 'pending') {
          clearInterval(interval)
          delete checkoutPollingRef.current[orderId]
          setActionFeedback((prev) => ({
            ...prev,
            [orderId]: { type: 'success', message: '✓ Pagamento confirmado via Checkout Web!' },
          }))
          await reloadOrders()
          await reloadReadyOrders()
        }
      } catch {
        // segue tentando
      }
    }, 3000)

    checkoutPollingRef.current[orderId] = interval
  }

  const handleOpenCheckoutWeb = async (orderId) => {
    try {
      setCheckingOutOrderId(orderId)
      setActionFeedback((prev) => ({
        ...prev,
        [orderId]: { type: 'info', message: 'Gerando link de checkout...' },
      }))
      const pref = await createMercadoPagoPreference(orderId)
      const initPoint = pref?.initPoint ?? pref?.sandboxInitPoint
      if (!initPoint) {
        throw new Error('Resposta sem URL de checkout.')
      }
      window.open(initPoint, '_blank', 'noopener,noreferrer')
      setActionFeedback((prev) => ({
        ...prev,
        [orderId]: { type: 'info', message: 'Checkout aberto. Finalize o pagamento na nova aba.' },
      }))
      pollCheckoutStatus(orderId)
    } catch (err) {
      setActionFeedback((prev) => ({
        ...prev,
        [orderId]: { type: 'error', message: normalizeErrorMessage(err) },
      }))
    } finally {
      setCheckingOutOrderId(null)
    }
  }

  const handleCopyPixCode = async (orderId) => {
    const code = pixStateByOrder?.[orderId]?.qrCode
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setCopyingOrderId(orderId)
      setTimeout(() => setCopyingOrderId((current) => (current === orderId ? null : current)), 1500)
    } catch (err) {
      setActionFeedback((prev) => ({
        ...prev,
        [orderId]: { type: 'error', message: 'Nao foi possivel copiar o codigo PIX.' },
      }))
    }
  }

  const pollPaymentStatus = (orderId) => {
    let attempts = 0
    const maxAttempts = 150 // 5 min × 60 seg / 2 seg por tentativa

    const interval = setInterval(async () => {
      attempts++

      if (attempts > maxAttempts) {
        clearInterval(interval)
        delete pollingIntervalsRef.current[orderId]
        setActionFeedback((prev) => ({
          ...prev,
          [orderId]: { type: 'error', message: 'Timeout. Recarregue a página ou tente novamente.' },
        }))
        return
      }

      try {
        const data = await getPaymentIntentStatus(orderId)
        if (data.success && data.orderStatus === 'em montagem') {
          clearInterval(interval)
          delete pollingIntervalsRef.current[orderId]
          setActionFeedback((prev) => ({
            ...prev,
            [orderId]: { type: 'success', message: '✓ Pagamento confirmado! Preparando...' },
          }))
          await reloadOrders()
          await reloadReadyOrders()
        }
        // Se ainda 'aguardando pagamento', continua polling
      } catch (err) {
        // Silenciosamente continua tentando
        console.warn('Erro ao verificar status do pagamento:', err)
      }
    }, 2000) // a cada 2 segundos

    if (pollingIntervalsRef.current[orderId]) {
      clearInterval(pollingIntervalsRef.current[orderId])
    }
    pollingIntervalsRef.current[orderId] = interval
  }

  const handleConfirmCash = async (orderId) => {
    try {
      setSendingOrderId(orderId)
      setActionFeedback((prev) => ({ ...prev, [orderId]: { type: 'info', message: 'Confirmando...' } }))
      await confirmOrderCash(orderId)
      setActionFeedback((prev) => ({ ...prev, [orderId]: { type: 'success', message: 'Pedido confirmado!' } }))
      await reloadOrders()
    } catch (err) {
      setActionFeedback((prev) => ({ ...prev, [orderId]: { type: 'error', message: normalizeErrorMessage(err) } }))
    } finally {
      setSendingOrderId(null)
    }
  }

  const handleCancelOrder = async (orderId) => {
    if (!window.confirm('Cancelar este pedido?')) return
    try {
      setCancelingOrderId(orderId)
      setActionFeedback((prev) => ({ ...prev, [orderId]: { type: 'info', message: 'Cancelando...' } }))
      await cancelOrder(orderId)
      await reloadOrders()
    } catch (err) {
      setActionFeedback((prev) => ({ ...prev, [orderId]: { type: 'error', message: normalizeErrorMessage(err) } }))
    } finally {
      setCancelingOrderId(null)
    }
  }

  return (
    <section className="grid gap-8 animate-fade-in">
      {/* Formulario de nova venda */}
      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="section-title">Nova venda</h2>
            <p className="section-sub">
              Selecione os itens, confirme o total e envie para a maquininha.
            </p>
          </div>
          <span className="pill pill-outline">Codigo 3 digitos</span>
        </div>
        <form onSubmit={handleSubmitSale} className="mt-6 grid gap-4">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.2em] text-espresso/50">
              Itens da venda
            </p>
            <button className="ghost-button small" type="button" onClick={addItem}>
              Adicionar item
            </button>
          </div>
          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={item.id} className="soft-card">
                <label className="field">
                  <span>Sabor {index + 1}</span>
                  <select
                    value={item.flavorId}
                    onChange={(e) => updateItem(item.id, 'flavorId', e.target.value)}
                    required
                  >
                    <option value="">Selecione um sabor</option>
                    {flavors.map((flavor) => {
                      const fId = getFlavorId(flavor)
                      const fName = getFlavorName(flavor)
                      const fPrice = getFlavorPrice(flavor)
                      return (
                        <option key={fId ?? fName} value={fId ?? fName}>
                          {fName}{fPrice !== null ? ` — ${formatCurrency(fPrice)}` : ''}
                        </option>
                      )
                    })}
                  </select>
                </label>
                <label className="field">
                  <span>Quantidade</span>
                  <input
                    type="number"
                    min="1"
                    value={item.qty}
                    onChange={(e) => updateItem(item.id, 'qty', e.target.value)}
                    required
                  />
                </label>
                {items.length > 1 && (
                  <button
                    className="ghost-button small"
                    type="button"
                    onClick={() => removeItem(item.id)}
                  >
                    Remover
                  </button>
                )}
              </div>
            ))}
          </div>
          <label className="field">
            <span>Nome do cliente (opcional)</span>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Nome do cliente (opcional)"
            />
          </label>
          <label className="field">
            <span>Forma de pagamento</span>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              <option value="point">Maquininha Point</option>
              <option value="pix">Pix</option>
              <option value="checkout_web">Checkout Web (MP)</option>
              <option value="dinheiro">Dinheiro</option>
            </select>
          </label>
          {submitFeedback && (
            <p className="text-sm text-espresso/70">{submitFeedback.message}</p>
          )}
          <div className="soft-card flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-espresso/50">
                Total estimado
              </p>
              <p className="text-xl font-semibold text-espresso">
                {estimatedTotal !== null ? formatCurrency(estimatedTotal) : '—'}
              </p>
            </div>
            <button className="primary-button" type="submit" disabled={submitting}>
              {submitting
                ? 'Enviando...'
                : (paymentMethod === 'dinheiro'
                  ? 'Confirmar pedido'
                  : paymentMethod === 'pix'
                    ? 'Gerar QR PIX'
                    : paymentMethod === 'checkout_web'
                      ? 'Abrir Checkout Web'
                    : 'Enviar para maquininha')}
            </button>
          </div>
        </form>
      </div>

      {/* Lista de pedidos existentes */}
      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="section-title">Pedidos pendentes</h2>
            <p className="section-sub">
              Pedidos ja criados aguardando envio para a maquininha.
            </p>
          </div>
          {error && !loading && (
            <p className="text-sm text-espresso/70">{error}</p>
          )}
        </div>
        <div className="mt-6 space-y-4">
          {loading && <p className="text-sm text-espresso/70">Carregando pedidos...</p>}
          {!loading && orders.filter((o) => !isOrderPaid(o)).length === 0 && (
            <p className="text-sm text-espresso/70">
              Nenhum pedido pendente no momento.
            </p>
          )}
          {orders
            .filter((order) => !isOrderPaid(order))
            .map((order) => {
              const orderId = getOrderId(order)
              const status = getOrderStatus(order)
              const total = getOrderTotal(order)
              const feedback = actionFeedback[orderId]
              const pixState = pixStateByOrder[orderId]

              return (
                <div key={orderId ?? JSON.stringify(order)} className="soft-card">
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-[0.2em] text-espresso/50">
                      Pedido #{orderId ?? 'Sem ID'}
                    </p>
                    {order?.customerName && (
                      <p className="text-sm font-medium text-espresso">{order.customerName}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm text-espresso/70">
                        Status: {status || 'Sem status'}
                      </p>
                      {getPaymentMethodLabel(order) && (
                        <span className="pill pill-small pill-outline">{getPaymentMethodLabel(order)}</span>
                      )}
                    </div>
                    {feedback && (
                      <p className="text-xs text-espresso/60">{feedback.message}</p>
                    )}
                    {isPaymentMethodPix(order) && (
                      pixState?.qrCodeBase64 ? (
                        <PixQrPanel
                          pixState={pixState}
                          onCopy={() => handleCopyPixCode(orderId)}
                          copied={copyingOrderId === orderId}
                        />
                      ) : (
                        <p className="text-xs text-espresso/50 italic">QR Code aguardando geração...</p>
                      )
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-semibold text-espresso">
                      {formatCurrency(total)}
                    </p>
                    {isPaymentMethodCash(order) ? (
                      <button
                        className="primary-button"
                        type="button"
                        onClick={() => handleConfirmCash(orderId)}
                        disabled={!orderId || sendingOrderId === orderId}
                      >
                        {sendingOrderId === orderId ? 'Confirmando...' : 'Confirmar pedido'}
                      </button>
                    ) : isPaymentMethodCheckout(order) ? (
                      <button
                        className="primary-button"
                        type="button"
                        onClick={() => handleOpenCheckoutWeb(orderId)}
                        disabled={!orderId || checkingOutOrderId === orderId}
                      >
                        {checkingOutOrderId === orderId ? 'Abrindo...' : 'Abrir checkout'}
                      </button>
                    ) : isPaymentMethodPix(order) ? (
                      <button
                        className="primary-button"
                        type="button"
                        onClick={() => handleGeneratePix(orderId)}
                        disabled={!orderId || sendingOrderId === orderId}
                      >
                        {sendingOrderId === orderId ? 'Gerando...' : (pixState?.qrCodeBase64 ? '🔄 Atualizar QR' : 'Gerar QR PIX')}
                      </button>
                    ) : (
                      <button
                        className="primary-button"
                        type="button"
                        onClick={() => handleSendToPos(orderId)}
                        disabled={!orderId || sendingOrderId === orderId}
                      >
                        {sendingOrderId === orderId ? 'Enviando...' : 'Enviar para maquininha'}
                      </button>
                    )}
                    <button
                      className="ghost-button small"
                      type="button"
                      onClick={() => handleCancelOrder(orderId)}
                      disabled={!orderId || cancelingOrderId === orderId}
                    >
                      {cancelingOrderId === orderId ? 'Cancelando...' : 'Cancelar'}
                    </button>
                  </div>
                </div>
              )
            })}
        </div>
      </div>
    </section>
  )
}

function KitchenPage({ orders, loading, error, reloadOrders }) {
  const [markingId, setMarkingId] = useState(null)
  const [markFeedback, setMarkFeedback] = useState({})
  const [pickupId, setPickupId] = useState(null)

  const handleMarkReady = async (orderId) => {
    try {
      setMarkingId(orderId)
      await markOrderReady(orderId)
      setMarkFeedback((prev) => ({ ...prev, [orderId]: 'Marcado como pronto.' }))
      await reloadOrders()
    } catch (err) {
      setMarkFeedback((prev) => ({ ...prev, [orderId]: normalizeErrorMessage(err) }))
    } finally {
      setMarkingId(null)
    }
  }

  const handlePickup = async (orderId) => {
    try {
      setPickupId(orderId)
      await pickupOrder(orderId)
      await reloadOrders()
    } catch (err) {
      setMarkFeedback((prev) => ({ ...prev, [orderId]: normalizeErrorMessage(err) }))
    } finally {
      setPickupId(null)
    }
  }

  const waitingOrders = orders.filter((o) => getOrderStatus(o) === 'aguardando pagamento')
  const inProgressOrders = orders.filter((o) => getOrderStatus(o) === 'em montagem')
  const readyOrders = orders.filter((o) => getOrderStatus(o) === 'pronto')

  return (
    <section className="grid gap-8 animate-fade-in">
      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="section-title">Cozinha</h2>
            <p className="section-sub">
              Veja pedidos pagos e marque quando estiverem prontos.
            </p>
          </div>
          <span className="pill pill-dark">
            {loading ? '...' : `${inProgressOrders.length} na fila`}
          </span>
        </div>
        {error && !loading && (
          <p className="mt-4 text-sm text-espresso/70">{error}</p>
        )}
        <div className="mt-6 space-y-4">
          {loading && <p className="text-sm text-espresso/70">Carregando...</p>}
          {!loading && inProgressOrders.length === 0 && (
            <p className="text-sm text-espresso/70">
              Nenhum pedido em preparo no momento.
            </p>
          )}
          {inProgressOrders.map((order) => {
            const orderId = getOrderId(order)
            const flavorName = getOrderFlavorName(order)
            const flavorQty = getOrderFlavorQty(order)
            const status = getOrderStatus(order)
            const total = getOrderTotal(order)
            const paymentCode = getPaymentCode(order)
            const feedback = markFeedback[orderId]

            return (
              <div key={orderId ?? JSON.stringify(order)} className="soft-card">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-espresso/50">
                    Pedido #{orderId ?? 'Sem ID'}
                  </p>
                  {paymentCode && (
                    <p className="text-sm font-semibold text-espresso">
                      Codigo: {paymentCode}
                    </p>
                  )}
                  {flavorName && (
                    <p className="section-title text-sm font-bold text-espresso/70">
                      {flavorName} · {flavorQty} fatia{flavorQty > 1 ? 's' : ''}
                    </p>
                  )}

                  {order?.customerName && (
                    <p className="text-sm font-bold text-espresso/70">{order.customerName}</p>
                  )}
                  <p className="text-sm text-espresso/60">
                    Status: {status || 'Sem status'}
                  </p>
                  {feedback && (
                    <p className="text-xs text-espresso/60 mt-1">{feedback}</p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-base font-semibold text-espresso">
                    {formatCurrency(total)}
                  </p>
                  <button
                    className="ghost-button small"
                    type="button"
                    onClick={() => handleMarkReady(orderId)}
                    disabled={markingId === orderId}
                  >
                    {markingId === orderId ? 'Salvando...' : 'Marcar pronto'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {!loading && readyOrders.length > 0 && (
          <>
            <div className="divider mt-6" />
            <p className="mt-4 text-xs uppercase tracking-[0.2em] text-espresso/50">
              Prontos para retirada ({readyOrders.length})
            </p>
            <div className="mt-3 space-y-3">
              {readyOrders.map((order) => {
                const orderId = getOrderId(order)
                const flavorName = getOrderFlavorName(order)
                const flavorQty = getOrderFlavorQty(order)
                const paymentCode = getPaymentCode(order)
                const total = getOrderTotal(order)
                const feedback = markFeedback[orderId]
                return (
                  <div key={orderId ?? JSON.stringify(order)} className="soft-card">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-espresso/50">
                        Pedido #{orderId ?? 'Sem ID'}
                      </p>
                      {paymentCode && (
                        <p className="text-sm font-semibold text-espresso">Codigo: {paymentCode}</p>
                      )}
                      {flavorName && (
                        <p className="text-sm font-bold text-espresso/70">
                          {flavorName} · {flavorQty} fatia{flavorQty > 1 ? 's' : ''}
                        </p>
                      )}
                      {order?.customerName && (
                        <p className="text-sm font-bold text-espresso/70">{order.customerName}</p>
                      )}
                      {feedback && (
                        <p className="text-xs text-espresso/60 mt-1">{feedback}</p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="text-base font-semibold text-espresso">
                        {formatCurrency(total)}
                      </p>
                      <button
                        className="primary-button"
                        type="button"
                        onClick={() => handlePickup(orderId)}
                        disabled={pickupId === orderId}
                      >
                        {pickupId === orderId ? 'Confirmando...' : '\u2713 Retirado'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {!loading && waitingOrders.length > 0 && (
          <>
            <div className="divider mt-6" />
            <p className="mt-4 text-xs uppercase tracking-[0.2em] text-espresso/50">
              Aguardando pagamento ({waitingOrders.length})
            </p>
            <div className="mt-3 space-y-3">
              {waitingOrders.map((order) => {
                const orderId = getOrderId(order)
                const flavorName = getOrderFlavorName(order)
                const flavorQty = getOrderFlavorQty(order)
                const status = getOrderStatus(order)
                const total = getOrderTotal(order)
                return (
                  <div key={orderId ?? JSON.stringify(order)} className="soft-card opacity-60">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-espresso/50">
                        Pedido #{orderId ?? 'Sem ID'}
                      </p>
                      {flavorName && (
                        <p className="text-sm text-espresso/70">
                          {flavorName} · {flavorQty} fatia{flavorQty > 1 ? 's' : ''}
                        </p>
                      )}
                      {order?.customerName && (
                        <p className="text-sm text-espresso/70">{order.customerName}</p>
                      )}
                      <p className="text-sm text-espresso/60">
                        Status: {status || 'Sem status'}
                      </p>
                    </div>
                    <p className="text-base font-semibold text-espresso">
                      {formatCurrency(total)}
                    </p>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </section>
  )
}

function TrackingPage({ readyOrders, loading, error, showBackButton = false, onBack }) {
  const visibleReadyOrders = useMemo(
    () =>
      readyOrders
        .filter((order) => getOrderStatus(order) === 'pronto')
        .map((order) => ({ order, code: getPaymentCode(order) }))
        .filter((item) => item.code),
    [readyOrders],
  )

  return (
    <section className="grid gap-8 animate-fade-in">
      <div className="card">
        {showBackButton && (
          <button
            className="ghost-button small"
            type="button"
            onClick={onBack}
            aria-label="Voltar para login"
          >
            ← Voltar
          </button>
        )}
        <h2 className="section-title">Pedidos prontos</h2>
        <p className="section-sub">
          Mostre os codigos para retirada no balcao.
        </p>
        {error && (
          <p className="mt-6 text-sm text-espresso/70">{error}</p>
        )}
        <div className="mt-6 flex flex-wrap gap-4">
          {loading && <p className="text-sm text-espresso/70">Carregando...</p>}
          {!loading && visibleReadyOrders.length === 0 && (
            <p className="text-sm text-espresso/70">
              Nenhum pedido pronto no momento.
            </p>
          )}
          {visibleReadyOrders.map(({ order, code }) => {
            const orderId = getOrderId(order)
            const flavorName = order?.flavorName ?? order?.flavor_name ?? ''
            return (
              <div key={orderId ?? code} className="ready-code-card">
                <p className="ready-code-num">{code}</p>
                {flavorName && (
                  <p className="ready-code-flavor">{flavorName}</p>
                )}
                {order?.customerName && (
                  <p className="ready-code-customer">{order.customerName}</p>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function ReportPage({ financials, costsData, loadingFinancials, loadingCosts, errorFinancials, errorCosts, reloadFinancials, reloadCosts }) {
  const [newCost, setNewCost] = useState({ label: '', amount: '', cadence: 'monthly', category: 'operational' })
  const [addingCost, setAddingCost] = useState(false)
  const [costFormError, setCostFormError] = useState('')
  const [deletingId, setDeletingId] = useState(null)

  const operationalCosts = costsData.filter((c) => c.category === 'operational')
  const productCosts = costsData.filter((c) => c.category === 'product')

  const handleAddCost = async (e) => {
    e.preventDefault()
    const amountCents = Math.round(parseCurrency(newCost.amount) * 100)
    if (!newCost.label.trim() || !amountCents || amountCents <= 0) {
      setCostFormError('Informe nome e valor valido (ex: 12,50)')
      return
    }
    try {
      setAddingCost(true)
      setCostFormError('')
      await addCost({ label: newCost.label.trim(), amountCents, cadence: newCost.cadence, category: newCost.category })
      setNewCost({ label: '', amount: '', cadence: 'monthly', category: 'operational' })
      await Promise.all([reloadCosts(), reloadFinancials()])
    } catch (err) {
      setCostFormError(normalizeErrorMessage(err))
    } finally {
      setAddingCost(false)
    }
  }

  const handleDeleteCost = async (costId) => {
    if (!window.confirm('Remover este custo?')) return
    try {
      setDeletingId(costId)
      await deleteCost(costId)
      await Promise.all([reloadCosts(), reloadFinancials()])
    } catch (err) {
      // silencioso — erro raro
    } finally {
      setDeletingId(null)
    }
  }

  const CostSection = ({ title, items, loadingSection }) => (
    <div className="mt-4 space-y-2">
      <p className="text-xs uppercase tracking-[0.2em] text-espresso/50">{title}</p>
      {loadingSection && <p className="text-sm text-espresso/70">Carregando...</p>}
      {!loadingSection && items.length === 0 && (
        <p className="text-sm text-espresso/60">Nenhum custo cadastrado.</p>
      )}
      {items.map((cost) => (
        <div key={cost.id} className="soft-card">
          <div>
            <p className="text-sm font-semibold text-espresso">{cost.label}</p>
            <p className="text-xs text-espresso/60">
              {cost.cadence === 'monthly' ? 'Mensal' : 'Avulso'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-base font-semibold text-espresso">
              {formatCurrency(cost.amountCents)}
            </p>
            <button
              className="ghost-button small"
              type="button"
              onClick={() => handleDeleteCost(cost.id)}
              disabled={deletingId === cost.id}
            >
              {deletingId === cost.id ? '...' : 'Remover'}
            </button>
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <section className="grid gap-8 lg:grid-cols-2 animate-fade-in">
      {/* Coluna esquerda — custos */}
      <div className="card">
        <h2 className="section-title">Controle de custos</h2>
        <p className="section-sub">Cadastre custos operacionais e de produto.</p>

        {errorCosts && <p className="mt-4 text-sm text-espresso/70">{errorCosts}</p>}

        <CostSection title="Custos Operacionais" items={operationalCosts} loadingSection={loadingCosts} />
        <CostSection title="Custos de Produto" items={productCosts} loadingSection={loadingCosts} />

        <div className="divider mt-6" />
        <form onSubmit={handleAddCost} className="mt-4 grid gap-3">
          <p className="text-xs uppercase tracking-[0.2em] text-espresso/50">Adicionar custo</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="field">
              <span>Nome</span>
              <input
                type="text"
                required
                placeholder="Ex: Aluguel"
                value={newCost.label}
                onChange={(e) => setNewCost((p) => ({ ...p, label: e.target.value }))}
              />
            </label>
            <label className="field">
              <span>Valor (R$)</span>
              <input
                type="text"
                required
                placeholder="Ex: 150,00"
                value={newCost.amount}
                onChange={(e) => setNewCost((p) => ({ ...p, amount: e.target.value }))}
              />
            </label>
            <label className="field">
              <span>Categoria</span>
              <select value={newCost.category} onChange={(e) => setNewCost((p) => ({ ...p, category: e.target.value }))}>
                <option value="operational">Operacional (aluguel, energia...)</option>
                <option value="product">Produto (ingredientes, embalagens...)</option>
              </select>
            </label>
            <label className="field">
              <span>Recorrencia</span>
              <select value={newCost.cadence} onChange={(e) => setNewCost((p) => ({ ...p, cadence: e.target.value }))}>
                <option value="monthly">Mensal</option>
                <option value="once">Avulso</option>
              </select>
            </label>
          </div>
          {costFormError && <p className="text-xs text-espresso/70">{costFormError}</p>}
          <div className="flex justify-end">
            <button className="primary-button" type="submit" disabled={addingCost}>
              {addingCost ? 'Salvando...' : 'Adicionar custo'}
            </button>
          </div>
        </form>
      </div>

      {/* Coluna direita — resumo financeiro */}
      <div className="card">
        <h2 className="section-title">Resumo financeiro</h2>
        <p className="section-sub">Resultado com base nas vendas confirmadas e custos cadastrados.</p>
        {errorFinancials && <p className="mt-4 text-sm text-espresso/70">{errorFinancials}</p>}
        <div className="mt-6 space-y-3">
          <div className="soft-card">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-espresso/50">Receita bruta</p>
              <p className="text-xl font-semibold text-espresso">
                {loadingFinancials ? 'Carregando...' : formatCurrency(financials?.gross ?? null)}
              </p>
            </div>
            <span className="pill pill-outline">Vendas confirmadas</span>
          </div>
          <div className="soft-card">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-espresso/50">Custos operacionais</p>
              <p className="text-xl font-semibold text-espresso">
                {loadingFinancials ? 'Carregando...' : formatCurrency(financials?.operationalCosts ?? null)}
              </p>
            </div>
            <span className="pill pill-small pill-outline">Aluguel, energia...</span>
          </div>
          <div className="soft-card">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-espresso/50">Custos de produto</p>
              <p className="text-xl font-semibold text-espresso">
                {loadingFinancials ? 'Carregando...' : formatCurrency(financials?.productCosts ?? null)}
              </p>
            </div>
            <span className="pill pill-small pill-outline">Ingredientes, embalagens...</span>
          </div>
          <div className="soft-card">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-espresso/50">Total de custos</p>
              <p className="text-xl font-semibold text-espresso">
                {loadingFinancials ? 'Carregando...' : formatCurrency(financials?.totalCosts ?? null)}
              </p>
            </div>
            <span className="pill pill-small pill-outline">Operacional + Produto</span>
          </div>
          <div className="divider" />
          <div className="soft-card">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-espresso/50">Lucro liquido</p>
              <p className="text-2xl font-bold text-espresso">
                {loadingFinancials ? 'Carregando...' : formatCurrency(financials?.net ?? null)}
              </p>
            </div>
            <span className="pill pill-dark">Resultado final</span>
          </div>
        </div>
      </div>
    </section>
  )
}

function LoginPage({ onLogin, loginError, loggingIn }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const nextPath = new URLSearchParams(location.search).get('next') || '/'

  const handleSubmit = async (e) => {
    e.preventDefault()
    const ok = await onLogin({ username: username.trim(), password })
    if (ok) navigate(nextPath, { replace: true })
  }

  return (
    <div className="min-h-screen bg-app px-6 py-10">
      <div className="mx-auto w-full max-w-md card">
        <h1 className="section-title">Entrar</h1>
        <p className="section-sub">Faça login para acessar o dashboard interno.</p>
        <form onSubmit={handleSubmit} className="mt-6 grid gap-3">
          <label className="field">
            <span>Usuário</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>Senha</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {loginError && <p className="text-sm text-espresso/70">{loginError}</p>}
          <button className="primary-button" type="submit" disabled={loggingIn}>
            {loggingIn ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}

function TrackingStandalonePage() {
  const readyOrdersState = useReadyOrders(true)
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-app px-6 py-8 text-slate-900">
      <div className="mx-auto w-full max-w-7xl">
        <TrackingPage
          readyOrders={readyOrdersState.orders}
          loading={readyOrdersState.loading}
          error={readyOrdersState.error}
          showBackButton
          onBack={() => navigate('/login?next=/', { replace: true })}
        />
      </div>
    </div>
  )
}

function AppLayout({ user, onLogout }) {
  const role = user?.role ?? user?.user?.role ?? ''
  const isAdmin = isAdminRole(role)
  const ordersState = useOrdersData(isAdmin)
  const readyOrdersState = useReadyOrders(isAdmin)
  const flavorsState = useFlavors()
  const statsState = useStats(isAdmin)
  const financialsState = useFinancials(isAdmin)
  const costsState = useCosts(isAdmin)

  const visibleNavItems = useMemo(() => {
    if (isAdmin) return navItems
    return navItems.filter((item) => item.to === '/' || item.to === '/sabores')
  }, [isAdmin])

  const handleShareTracking = useCallback(async () => {
    const url = `${window.location.origin}/acompanhamento`
    try {
      await navigator.clipboard.writeText(url)
      window.alert('Link de acompanhamento copiado!')
    } catch {
      window.prompt('Copie o link abaixo:', url)
    }
  }, [])

  return (
    <div className="min-h-screen bg-app text-slate-900">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8 lg:flex-row">
        <aside className="sidebar card lg:w-64">
          <div className="flex flex-col gap-2">
            <p className="text-xs uppercase tracking-[0.4em] text-espresso/60">
              Navegação
            </p>
            <h2 className="text-xl font-display uppercase tracking-[0.12em] text-espresso">
              Forninho Mágico
            </h2>
            <p className="text-xs text-espresso/60">{isAdmin ? 'Perfil ADMIN' : 'Usuário comum'}</p>
          </div>
          <nav className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            {visibleNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `nav-link ${isActive ? 'nav-link-active' : ''}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <button className="ghost-button mt-6" type="button" onClick={onLogout}>
            Sair
          </button>
        </aside>
        <main className="flex-1">
          <Routes>
            <Route
              path="/"
              element={
                <DashboardPage
                  stats={statsState.data}
                  loadingStats={statsState.loading}
                  errorStats={statsState.error}
                  flavors={flavorsState.flavors}
                  loadingFlavors={flavorsState.loading}
                  canViewStats={isAdmin}
                  onShareTracking={handleShareTracking}
                />
              }
            />
            <Route
              path="/sabores"
              element={
                <FlavorsPage
                  flavors={flavorsState.flavors}
                  loading={flavorsState.loading}
                  error={flavorsState.error}
                  reloadFlavors={flavorsState.reload}
                  canManageFlavors={isAdmin}
                />
              }
            />
            <Route
              path="/vender"
              element={isAdmin ? (
                <SalesPage
                  orders={ordersState.orders}
                  loading={ordersState.loading}
                  error={ordersState.error}
                  flavors={flavorsState.flavors}
                  reloadOrders={ordersState.reload}
                  reloadReadyOrders={readyOrdersState.reload}
                />
              ) : <Navigate to="/" replace />}
            />
            <Route
              path="/cozinha"
              element={isAdmin ? (
                <KitchenPage
                  orders={ordersState.orders}
                  loading={ordersState.loading}
                  error={ordersState.error}
                  reloadOrders={ordersState.reload}
                />
              ) : <Navigate to="/" replace />}
            />
            <Route
              path="/relatorio"
              element={isAdmin ? (
                <ReportPage
                  financials={financialsState.data}
                  costsData={costsState.costs}
                  loadingFinancials={financialsState.loading}
                  loadingCosts={costsState.loading}
                  errorFinancials={financialsState.error}
                  errorCosts={costsState.error}
                  reloadFinancials={financialsState.reload}
                  reloadCosts={costsState.reload}
                />
              ) : <Navigate to="/" replace />}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

function App() {
  const [authUser, setAuthUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authError, setAuthError] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)
  const [signingUp, setSigningUp] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)

  const saveAuthSession = useCallback((result) => {
    const token = result?.token ?? result?.accessToken ?? ''
    const user = result?.user ?? null
    if (token) setStoredAuthToken(token)
    if (user) localStorage.setItem('forninho_auth_user', JSON.stringify(user))
    setAuthUser(user)
    return Boolean(token && user)
  }, [])

  const clearAuthSession = useCallback(() => {
    clearStoredAuthToken()
    localStorage.removeItem('forninho_auth_user')
    setAuthUser(null)
  }, [])

  useEffect(() => {
    const bootstrapAuth = async () => {
      const token = getStoredAuthToken()
      if (!token) {
        setAuthLoading(false)
        return
      }
      try {
        const me = await getCurrentUser()
        const user = me?.user ?? me
        if (user) {
          localStorage.setItem('forninho_auth_user', JSON.stringify(user))
        }
        setAuthUser(user)
      } catch {
        clearAuthSession()
      } finally {
        setAuthLoading(false)
      }
    }
    bootstrapAuth()
  }, [clearAuthSession])

  useEffect(() => {
    const handleAuthExpired = () => {
      clearAuthSession()
      setAuthError('Sua sessão expirou. Faça login novamente.')
    }
    window.addEventListener('forninho:auth-expired', handleAuthExpired)
    return () => window.removeEventListener('forninho:auth-expired', handleAuthExpired)
  }, [clearAuthSession])

  const handleLogin = useCallback(async ({ username, password }) => {
    try {
      setLoggingIn(true)
      setAuthError('')
      const result = await loginUser({ username, password })
      const user = result?.user ?? null
      const normalized = { ...result, user }
      if (!normalized.user && normalized.token) {
        const me = await getCurrentUser()
        normalized.user = me?.user ?? me ?? null
      }
      return saveAuthSession(normalized)
    } catch (err) {
      clearAuthSession()
      setAuthError(normalizeErrorMessage(err))
      return false
    } finally {
      setLoggingIn(false)
    }
  }, [clearAuthSession, saveAuthSession])

  const handleSignup = useCallback(async ({ username, name, password, phone }) => {
    try {
      setSigningUp(true)
      setAuthError('')
      const result = await signupUser({
        username: username.trim(),
        name: name.trim(),
        password,
        phone: onlyDigits(phone),
      })
      return saveAuthSession(result)
    } catch (err) {
      clearAuthSession()
      setAuthError(normalizeErrorMessage(err))
      return false
    } finally {
      setSigningUp(false)
    }
  }, [clearAuthSession, saveAuthSession])

  const handleChangePassword = useCallback(async ({ phone, newPassword }) => {
    try {
      setChangingPassword(true)
      setAuthError('')
      const result = await changePasswordByPhone({
        phone: onlyDigits(phone),
        newPassword,
      })
      return saveAuthSession(result)
    } catch (err) {
      clearAuthSession()
      setAuthError(normalizeErrorMessage(err))
      return false
    } finally {
      setChangingPassword(false)
    }
  }, [clearAuthSession, saveAuthSession])

  const handleLogout = useCallback(() => {
    clearAuthSession()
    setAuthError('')
  }, [clearAuthSession])

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            authUser
              ? <Navigate to="/" replace />
              : (
                <LoginPage
                  onLogin={handleLogin}
                  loginError={authError}
                  loggingIn={loggingIn}
                />
              )
          }
        />
        <Route
          path="/signup"
          element={
            authUser
              ? <Navigate to="/" replace />
              : (
                <SignupPage
                  onSignup={handleSignup}
                  loading={signingUp}
                  error={authError}
                />
              )
          }
        />
        <Route
          path="/change-password"
          element={
            authUser
              ? <Navigate to="/" replace />
              : (
                <ChangePasswordPage
                  onChangePassword={handleChangePassword}
                  loading={changingPassword}
                  error={authError}
                />
              )
          }
        />
        <Route path="/acompanhamento" element={<TrackingStandalonePage />} />
        <Route
          path="/*"
          element={
            authLoading
              ? <div className="min-h-screen bg-app px-6 py-10 text-espresso">Carregando...</div>
              : (authUser ? <AppLayout user={authUser} onLogout={handleLogout} /> : <Navigate to="/login?next=/" replace />)
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App
