import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom'

const flavors = [
  {
    id: 1,
    name: 'Brigadeiro da Casa',
    price: 'R$ 12,00',
    slicesLeft: 18,
    slicesTotal: 30,
    active: true,
  },
  {
    id: 2,
    name: 'Doce de Leite Fino',
    price: 'R$ 11,00',
    slicesLeft: 4,
    slicesTotal: 24,
    active: true,
  },
  {
    id: 3,
    name: 'Morango com Creme',
    price: 'R$ 14,00',
    slicesLeft: 0,
    slicesTotal: 18,
    active: false,
  },
]

const orders = [
  {
    id: 1042,
    code: '283',
    flavor: 'Brigadeiro da Casa',
    qty: 2,
    status: 'em montagem',
    total: 'R$ 24,00',
  },
  {
    id: 1043,
    code: '914',
    flavor: 'Doce de Leite Fino',
    qty: 1,
    status: 'em montagem',
    total: 'R$ 11,00',
  },
  {
    id: 1039,
    code: '127',
    flavor: 'Brigadeiro da Casa',
    qty: 1,
    status: 'pronto',
    total: 'R$ 12,00',
  },
]

const readyCodes = ['127', '552', '880']

const costs = [
  { id: 1, label: 'Leite condensado', amount: 'R$ 280,00' },
  { id: 2, label: 'Gas e energia', amount: 'R$ 190,00' },
  { id: 3, label: 'Embalagens', amount: 'R$ 95,00' },
]

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/sabores', label: 'Sabores e produtos' },
  { to: '/vender', label: 'Vender' },
  { to: '/cozinha', label: 'Cozinha' },
  { to: '/acompanhamento', label: 'Acompanhamento' },
  { to: '/relatorio', label: 'Relatorio' },
]

function DashboardPage() {
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
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="stat-card">
          <p className="stat-label">Lucro bruto hoje</p>
          <p className="stat-value">R$ 1.245,00</p>
          <p className="stat-sub">+12% vs ontem</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Custos do mes</p>
          <p className="stat-value">R$ 565,00</p>
          <p className="stat-sub">3 custos ativos</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Lucro liquido</p>
          <p className="stat-value">R$ 680,00</p>
          <p className="stat-sub">Meta 78%</p>
        </div>
      </div>
    </section>
  )
}

function FlavorsPage() {
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
          <button className="ghost-button">Cadastrar sabor</button>
        </div>
        <div className="mt-6 space-y-4">
          {flavors.map((flavor) => (
            <div key={flavor.id} className="soft-card">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold text-espresso">
                    {flavor.name}
                  </h3>
                  <span
                    className={`pill pill-small ${
                      flavor.active ? 'pill-dark' : 'pill-outline'
                    }`}
                  >
                    {flavor.active ? 'Ativo' : 'Pausado'}
                  </span>
                </div>
                <p className="text-sm text-espresso/60">
                  {flavor.price} por fatia
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-espresso/50">
                    Estoque
                  </p>
                  <p className="text-base font-semibold text-espresso">
                    {flavor.slicesLeft} / {flavor.slicesTotal}
                  </p>
                </div>
                <button className="ghost-button small">Adicionar fatias</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function SalesPage() {
  const saleItems = [
    { id: 1, flavor: 'Brigadeiro da Casa', qty: 1 },
    { id: 2, flavor: 'Doce de Leite Fino', qty: 2 },
  ]

  return (
    <section className="grid gap-8 animate-fade-in">
      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="section-title">Vendas presenciais</h2>
            <p className="section-sub">
              Cada pedido envia o valor para a maquininha e gera um codigo.
            </p>
          </div>
          <span className="pill pill-outline">Codigo 3 digitos</span>
        </div>
        <form className="mt-6 grid gap-4">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.2em] text-espresso/50">
              Itens da venda
            </p>
            <button className="ghost-button small" type="button">
              Adicionar item
            </button>
          </div>
          <div className="space-y-3">
            {saleItems.map((item, index) => (
              <div key={item.id} className="soft-card">
                <label className="field">
                  <span>Sabor {index + 1}</span>
                  <select defaultValue={item.flavor}>
                    <option>Brigadeiro da Casa</option>
                    <option>Doce de Leite Fino</option>
                    <option>Morango com Creme</option>
                  </select>
                </label>
                <label className="field">
                  <span>Quantidade</span>
                  <input type="number" min="1" defaultValue={item.qty} />
                </label>
                <button className="ghost-button small" type="button">
                  Remover
                </button>
              </div>
            ))}
          </div>
          <label className="field">
            <span>Forma de pagamento</span>
            <select>
              <option>Cartao (Mercado Pago)</option>
              <option>Pix</option>
            </select>
          </label>
          <div className="soft-card flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-espresso/50">
                Total estimado
              </p>
              <p className="text-xl font-semibold text-espresso">R$ 46,00</p>
            </div>
            <button className="primary-button">Enviar para maquininha</button>
          </div>
        </form>
      </div>
    </section>
  )
}

function KitchenPage() {
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
          <span className="pill pill-dark">Fila ativa</span>
        </div>
        <div className="mt-6 space-y-4">
          {orders.map((order) => (
            <div key={order.id} className="soft-card">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-espresso/50">
                  Pedido #{order.id}
                </p>
                <p className="text-lg font-semibold text-espresso">
                  {order.flavor} x {order.qty}
                </p>
                <p className="text-sm text-espresso/60">
                  Codigo {order.code} · {order.total}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="pill pill-small">
                  {order.status.toUpperCase()}
                </span>
                <button className="ghost-button small">Marcar pronto</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function TrackingPage() {
  return (
    <section className="grid gap-8 animate-fade-in">
      <div className="card">
        <h2 className="section-title">Pedidos prontos</h2>
        <p className="section-sub">
          Mostre os codigos para retirada no balcao.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {readyCodes.map((code) => (
            <span key={code} className="ready-code">
              {code}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

function ReportPage() {
  return (
    <section className="grid gap-8 lg:grid-cols-2 animate-fade-in">
      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="section-title">Controle de custos</h2>
            <p className="section-sub">
              Custos mensais descontados do lucro bruto.
            </p>
          </div>
          <button className="ghost-button">Cadastrar custo</button>
        </div>
        <div className="mt-6 space-y-3">
          {costs.map((cost) => (
            <div key={cost.id} className="soft-card">
              <div>
                <p className="text-sm font-semibold text-espresso">
                  {cost.label}
                </p>
                <p className="text-xs text-espresso/60">Recorrente</p>
              </div>
              <p className="text-base font-semibold text-espresso">
                {cost.amount}
              </p>
            </div>
          ))}
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
                R$ 3.420,00
              </p>
            </div>
            <span className="pill pill-outline">+24 vendas</span>
          </div>
          <div className="soft-card">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-espresso/50">
                Custos totais
              </p>
              <p className="text-xl font-semibold text-espresso">
                -R$ 565,00
              </p>
            </div>
            <span className="pill pill-small">3 custos</span>
          </div>
          <div className="soft-card">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-espresso/50">
                Lucro liquido
              </p>
              <p className="text-2xl font-semibold text-espresso">
                R$ 2.855,00
              </p>
            </div>
            <span className="pill pill-dark">Dentro da meta</span>
          </div>
        </div>
      </div>
    </section>
  )
}

function AppLayout() {
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
            <Route path="/" element={<DashboardPage />} />
            <Route path="/sabores" element={<FlavorsPage />} />
            <Route path="/vender" element={<SalesPage />} />
            <Route path="/cozinha" element={<KitchenPage />} />
            <Route path="/acompanhamento" element={<TrackingPage />} />
            <Route path="/relatorio" element={<ReportPage />} />
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
