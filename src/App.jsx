import { useCallback, useEffect, useMemo, useState } from 'react'
import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom'
import {
  addFlavor,
  addSlices,
  createOrder,
  createPosIntent,
  getFlavors,
  getOrders,
  getReadyOrders,
  markOrderReady,
} from './api/backend'

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/sabores', label: 'Sabores e produtos' },
  { to: '/vender', label: 'Vender' },
  { to: '/cozinha', label: 'Cozinha' },
  { to: '/acompanhamento', label: 'Acompanhamento' },
  { to: '/relatorio', label: 'Relatorio' },
]

function getOrderId(order) {
  return order?.id ?? order?.orderId ?? order?.order_id ?? null
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

function isOrderPaid(order) {
  // Status 'aguardando pagamento' = nao pago; todo o resto (em montagem, pronto, etc) = pago
  const status = String(getOrderStatus(order)).toLowerCase()
  return status !== '' && status !== 'aguardando pagamento'
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

function useOrdersData() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true)
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
  }, [])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  return { orders, loading, error, reload: loadOrders }
}

function useReadyOrders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadReadyOrders = useCallback(async (showLoading = true) => {
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
  }, [])

  useEffect(() => {
    loadReadyOrders()
    const interval = setInterval(() => loadReadyOrders(false), 5000)
    return () => clearInterval(interval)
  }, [loadReadyOrders])

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

function DashboardPage({ orders, loading, error }) {
  const stats = useMemo(() => {
    const totalOrders = orders.length
    const paidOrders = orders.filter(isOrderPaid).length
    const pendingOrders = totalOrders - paidOrders
    const totals = orders
      .map((order) => parseCurrency(getOrderTotal(order)))
      .filter((value) => typeof value === 'number')
    const revenue = totals.length
      ? totals.reduce((sum, value) => sum + value, 0)
      : null

    return {
      totalOrders,
      paidOrders,
      pendingOrders,
      revenue,
    }
  }, [orders])

  return (
    <section className="flex flex-col gap-8 animate-fade-in">
      <header className="card">
        <div className="flex flex-wrap items-center gap-3">
          <span className="pill">SaaS de confeitaria</span>
          <span className="pill pill-dark">Vendas presenciais</span>
          <span className="pill pill-outline">Mercado Pago</span>
        </div>
        <div className="mt-6">
          <h1 className="text-balance text-4xl font-display uppercase tracking-[0.12em] text-espresso sm:text-5xl">
            Forninho Magico da Ana
          </h1>
          <p className="mt-4 max-w-xl text-base text-espresso/70">
            Dashboard para vendas, estoque de fatias e controle de lucro.
            Cada venda gera um codigo de 3 digitos para acompanhar o pedido.
          </p>
        </div>
      </header>
      {error && (
        <div className="card">
          <p className="text-sm text-espresso/70">{error}</p>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="stat-card">
          <p className="stat-label">Total em pedidos</p>
          <p className="stat-value">
            {loading ? 'Carregando...' : formatCurrency(stats.revenue)}
          </p>
          <p className="stat-sub">Pedidos carregados: {stats.totalOrders}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Pedidos pagos</p>
          <p className="stat-value">
            {loading ? 'Carregando...' : stats.paidOrders}
          </p>
          <p className="stat-sub">Status confirmado no backend</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Pedidos pendentes</p>
          <p className="stat-value">
            {loading ? 'Carregando...' : stats.pendingOrders}
          </p>
          <p className="stat-sub">Aguardando pagamento</p>
        </div>
      </div>
    </section>
  )
}

function FlavorsPage({ flavors, loading, error, reloadFlavors }) {
  const [showNewFlavor, setShowNewFlavor] = useState(false)
  const [newFlavor, setNewFlavor] = useState({ name: '', price: '', slicesTotal: '' })
  const [savingFlavor, setSavingFlavor] = useState(false)
  const [flavorFormError, setFlavorFormError] = useState('')

  const [addingSlicesFor, setAddingSlicesFor] = useState(null)
  const [slicesQty, setSlicesQty] = useState(1)
  const [savingSlices, setSavingSlices] = useState(false)
  const [slicesErrors, setSlicesErrors] = useState({})

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
      await addFlavor({
        name: newFlavor.name.trim(),
        price,
        slicesTotal: Number(newFlavor.slicesTotal) || 0,
      })
      setNewFlavor({ name: '', price: '', slicesTotal: '' })
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

  return (
    <section className="grid gap-8 animate-fade-in">
      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="section-title">Sabores e produtos</h2>
            <p className="section-sub">
              Controle a quantidade de fatias disponiveis por sabor.
            </p>
          </div>
          <button
            className="ghost-button"
            type="button"
            onClick={() => { setShowNewFlavor((v) => !v); setFlavorFormError('') }}
          >
            {showNewFlavor ? 'Cancelar' : 'Cadastrar sabor'}
          </button>
        </div>

        {showNewFlavor && (
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

            return (
              <div key={flavorId ?? name} className="soft-card">
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
                <div className="flex flex-wrap items-center gap-4">
                  {slices.left !== null && (
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-espresso/50">Estoque</p>
                      <p className="text-base font-semibold text-espresso">
                        {slices.left}{slices.total !== null ? ` / ${slices.total}` : ''}
                      </p>
                    </div>
                  )}
                  {isAddingHere ? (
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
                  ) : (
                    <button
                      className="ghost-button small"
                      type="button"
                      onClick={() => { setAddingSlicesFor(flavorId); setSlicesQty(1) }}
                    >
                      Adicionar fatias
                    </button>
                  )}
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
  const [submitting, setSubmitting] = useState(false)
  const [submitFeedback, setSubmitFeedback] = useState(null)

  const [sendingOrderId, setSendingOrderId] = useState(null)
  const [actionFeedback, setActionFeedback] = useState({})

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
    try {
      setSubmitting(true)
      setSubmitFeedback(null)
      // Backend cria um pedido por item — criar em sequencia
      const createdOrders = []
      for (const item of validItems) {
        const order = await createOrder({
          flavorId: item.flavorId,
          qty: Number(item.qty),
          paymentMethod,
        })
        createdOrders.push(order)
      }
      if (paymentMethod === 'point') {
        for (const order of createdOrders) {
          const orderId = getOrderId(order)
          if (orderId) {
            await createPosIntent(orderId)
          }
        }
        setSubmitFeedback({ type: 'success', message: 'Aguardando pagamento na maquininha...' })
      } else {
        const count = createdOrders.length
        setSubmitFeedback({ type: 'success', message: `${count > 1 ? `${count} pedidos criados` : 'Pedido criado'} com sucesso!` })
      }
      setItems([{ id: Date.now(), flavorId: '', qty: 1 }])
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
        [orderId]: { type: 'success', message: 'Aguardando pagamento na maquininha...' },
      }))
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
            <span>Forma de pagamento</span>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              <option value="point">Maquininha Point</option>
              <option value="card">Cartao (Mercado Pago)</option>
              <option value="pix">Pix</option>
              <option value="cash">Dinheiro</option>
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
              {submitting ? 'Enviando...' : 'Enviar para maquininha'}
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

              return (
                <div key={orderId ?? JSON.stringify(order)} className="soft-card">
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-[0.2em] text-espresso/50">
                      Pedido #{orderId ?? 'Sem ID'}
                    </p>
                    <p className="text-sm text-espresso/70">
                      Status: {status || 'Sem status'}
                    </p>
                    {feedback && (
                      <p className="text-xs text-espresso/60">{feedback.message}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <p className="text-base font-semibold text-espresso">
                      {formatCurrency(total)}
                    </p>
                    <button
                      className="primary-button"
                      type="button"
                      onClick={() => handleSendToPos(orderId)}
                      disabled={!orderId || sendingOrderId === orderId}
                    >
                      {sendingOrderId === orderId ? 'Enviando...' : 'Enviar para maquininha'}
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

  const waitingOrders = orders.filter((o) => getOrderStatus(o) === 'aguardando pagamento')
  const inProgressOrders = orders.filter((o) => getOrderStatus(o) === 'em montagem')

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

        {!loading && waitingOrders.length > 0 && (
          <>
            <div className="divider mt-6" />
            <p className="mt-4 text-xs uppercase tracking-[0.2em] text-espresso/50">
              Aguardando pagamento ({waitingOrders.length})
            </p>
            <div className="mt-3 space-y-3">
              {waitingOrders.map((order) => {
                const orderId = getOrderId(order)
                const status = getOrderStatus(order)
                const total = getOrderTotal(order)
                return (
                  <div key={orderId ?? JSON.stringify(order)} className="soft-card opacity-60">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-espresso/50">
                        Pedido #{orderId ?? 'Sem ID'}
                      </p>
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

function TrackingPage({ readyOrders, loading, error }) {
  const visibleReadyOrders = useMemo(
    () =>
      readyOrders
        .map((order) => ({ order, code: getPaymentCode(order) }))
        .filter((item) => item.code),
    [readyOrders],
  )

  return (
    <section className="grid gap-8 animate-fade-in">
      <div className="card">
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
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function ReportPage({ orders, loading, error }) {
  const totals = useMemo(() => {
    const values = orders
      .map((order) => parseCurrency(getOrderTotal(order)))
      .filter((value) => typeof value === 'number')
    const revenue = values.length
      ? values.reduce((sum, value) => sum + value, 0)
      : null
    const paidOrders = orders.filter(isOrderPaid).length
    return { revenue, paidOrders }
  }, [orders])

  return (
    <section className="grid gap-8 lg:grid-cols-2 animate-fade-in">
      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="section-title">Controle de custos</h2>
            <p className="section-sub">
              Dados retornados pelo backend de pedidos.
            </p>
          </div>
        </div>
        {error && (
          <p className="mt-6 text-sm text-espresso/70">{error}</p>
        )}
        <div className="mt-6 space-y-3">
          {loading && <p className="text-sm text-espresso/70">Carregando...</p>}
          {!loading && orders.length === 0 && (
            <p className="text-sm text-espresso/70">
              Nenhum pedido retornado pelo backend.
            </p>
          )}
          {orders.map((order) => {
            const orderId = getOrderId(order)
            const status = getOrderStatus(order)
            const total = getOrderTotal(order)

            return (
              <div key={orderId ?? JSON.stringify(order)} className="soft-card">
                <div>
                  <p className="text-sm font-semibold text-espresso">
                    Pedido #{orderId ?? 'Sem ID'}
                  </p>
                  <p className="text-xs text-espresso/60">
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
      </div>
      <div className="card">
        <h2 className="section-title">Resumo financeiro</h2>
        <p className="section-sub">
          Resultado do mes com base nas vendas e custos ativos.
        </p>
        <div className="mt-6 space-y-4">
          <div className="soft-card">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-espresso/50">
                Lucro bruto
              </p>
              <p className="text-xl font-semibold text-espresso">
                {loading ? 'Carregando...' : formatCurrency(totals.revenue)}
              </p>
            </div>
            <span className="pill pill-outline">
              {loading ? '...' : `${orders.length} pedidos`}
            </span>
          </div>
          <div className="soft-card">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-espresso/50">
                Pedidos pagos
              </p>
              <p className="text-xl font-semibold text-espresso">
                {loading ? 'Carregando...' : totals.paidOrders}
              </p>
            </div>
            <span className="pill pill-small">Status confirmado</span>
          </div>
          <div className="soft-card">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-espresso/50">
                Pedidos pendentes
              </p>
              <p className="text-2xl font-semibold text-espresso">
                {loading ? 'Carregando...' : orders.length - totals.paidOrders}
              </p>
            </div>
            <span className="pill pill-dark">Aguardando pagamento</span>
          </div>
        </div>
      </div>
    </section>
  )
}

function AppLayout() {
  const ordersState = useOrdersData()
  const readyOrdersState = useReadyOrders()
  const flavorsState = useFlavors()

  return (
    <div className="min-h-screen bg-app text-slate-900">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8 lg:flex-row">
        <aside className="sidebar card lg:w-64">
          <div className="flex flex-col gap-2">
            <p className="text-xs uppercase tracking-[0.4em] text-espresso/60">
              Navegacao
            </p>
            <h2 className="text-xl font-display uppercase tracking-[0.12em] text-espresso">
              Forninho Magico
            </h2>
          </div>
          <nav className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            {navItems.map((item) => (
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
        </aside>
        <main className="flex-1">
          <Routes>
            <Route
              path="/"
              element={
                <DashboardPage
                  orders={ordersState.orders}
                  loading={ordersState.loading}
                  error={ordersState.error}
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
                />
              }
            />
            <Route
              path="/vender"
              element={
                <SalesPage
                  orders={ordersState.orders}
                  loading={ordersState.loading}
                  error={ordersState.error}
                  flavors={flavorsState.flavors}
                  reloadOrders={ordersState.reload}
                  reloadReadyOrders={readyOrdersState.reload}
                />
              }
            />
            <Route
              path="/cozinha"
              element={
                <KitchenPage
                  orders={ordersState.orders}
                  loading={ordersState.loading}
                  error={ordersState.error}
                  reloadOrders={ordersState.reload}
                />
              }
            />
            <Route
              path="/acompanhamento"
              element={
                <TrackingPage
                  readyOrders={readyOrdersState.orders}
                  loading={readyOrdersState.loading}
                  error={readyOrdersState.error}
                />
              }
            />
            <Route
              path="/relatorio"
              element={
                <ReportPage
                  orders={ordersState.orders}
                  loading={ordersState.loading}
                  error={ordersState.error}
                />
              }
            />
          </Routes>
        </main>
      </div>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  )
}

export default App
