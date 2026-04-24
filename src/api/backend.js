const API_BASE = import.meta.env.VITE_API_URL ?? ''

async function readResponseBody(response) {
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return response.json()
  }
  return response.text()
}

function buildErrorMessage(response, body) {
  if (body && typeof body === 'object') {
    return body.message || body.error || response.statusText
  }
  if (typeof body === 'string' && body.trim()) {
    return body
  }
  return response.statusText
}

async function requestJson(path, options = {}) {
  const fullUrl = `${API_BASE}${path}`
  const response = await fetch(fullUrl, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  })

  if (!response.ok) {
    const body = await readResponseBody(response)
    const message = buildErrorMessage(response, body)
    const error = new Error(message || 'Erro ao comunicar com o backend')
    error.status = response.status
    error.body = body
    throw error
  }

  return readResponseBody(response)
}

export async function getStats() {
  return requestJson('/api/stats', { method: 'GET' })
}

export async function getOrders() {
  return requestJson('/api/orders', { method: 'GET' })
}

export async function getOrdersByStatus(status) {
  return requestJson(`/api/orders?status=${encodeURIComponent(status)}`, { method: 'GET' })
}

export async function getReadyOrders() {
  return requestJson('/api/orders/ready', { method: 'GET' })
}

export async function createPosIntent(orderId) {
  return requestJson('/api/payments/mercadopago/pos/intent', {
    method: 'POST',
    body: JSON.stringify({ orderId }),
  })
}

export async function createPixPayment(orderId) {
  return requestJson('/api/payments/mercadopago/pix/create', {
    method: 'POST',
    body: JSON.stringify({ orderId }),
  })
}

export async function getPixQrCode(orderId) {
  return requestJson(`/api/payments/mercadopago/pix/qrcode/${orderId}`, { method: 'GET' })
}

export async function getPaymentIntentStatus(orderId) {
  return requestJson(`/api/payments/mercadopago/pos/intent-status/${orderId}`, { method: 'GET' })
}

export async function getFlavors() {
  return requestJson('/api/flavors', { method: 'GET' })
}

export async function addFlavor({ name, price, slicesTotal, imageUrl }) {
  const body = {
    name,
    priceCents: Math.round(Number(price) * 100),
    slicesTotal: Number(slicesTotal) || 0,
    slicesAvailable: Number(slicesTotal) || 0,
  }
  if (imageUrl) body.imageUrl = imageUrl
  return requestJson('/api/flavors', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateFlavor(flavorId, fields) {
  return requestJson(`/api/flavors/${flavorId}`, {
    method: 'PATCH',
    body: JSON.stringify(fields),
  })
}

export async function uploadImage(file) {
  const formData = new FormData()
  formData.append('image', file)
  const fullUrl = `${API_BASE}/api/upload`
  const response = await fetch(fullUrl, { method: 'POST', body: formData })
  if (!response.ok) {
    const body = await readResponseBody(response)
    const message = buildErrorMessage(response, body)
    const error = new Error(message || 'Erro ao fazer upload da imagem')
    error.status = response.status
    throw error
  }
  return readResponseBody(response)
}

export async function addSlices(flavorId, quantity) {
  return requestJson(`/api/flavors/${flavorId}/slices`, {
    method: 'POST',
    body: JSON.stringify({ amount: Number(quantity) }),
  })
}

// Backend aceita um item por pedido — cria um pedido por item
export async function createOrder({ flavorId, qty, paymentMethod, customerName }) {
  const body = { flavorId: Number(flavorId), qty: Number(qty), paymentMethod }
  if (customerName) body.customerName = customerName
  return requestJson('/api/orders', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function markOrderReady(orderId) {
  return requestJson(`/api/orders/${orderId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'pronto' }),
  })
}

export async function confirmOrderCash(orderId) {
  return requestJson(`/api/orders/${orderId}/confirm`, {
    method: 'PATCH',
    body: JSON.stringify({}),
  })
}

export async function cancelOrder(orderId) {
  return requestJson(`/api/orders/${orderId}`, { method: 'DELETE' })
}

export async function pickupOrder(orderId) {
  return requestJson(`/api/orders/${orderId}/pickup`, { method: 'PATCH' })
}

export async function getFinancials() {
  return requestJson('/api/financials', { method: 'GET' })
}

export async function getCosts() {
  return requestJson('/api/costs', { method: 'GET' })
}

export async function addCost({ label, amountCents, cadence, category }) {
  return requestJson('/api/costs', {
    method: 'POST',
    body: JSON.stringify({ label, amountCents, cadence, category }),
  })
}

export async function deleteCost(costId) {
  return requestJson(`/api/costs/${costId}`, { method: 'DELETE' })
}
