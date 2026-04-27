const API_BASE = import.meta.env.VITE_API_URL ?? ''
const AUTH_STORAGE_KEY = 'forninho_auth_token'

export function getStoredAuthToken() {
  return localStorage.getItem(AUTH_STORAGE_KEY) || ''
}

export function setStoredAuthToken(token) {
  if (token) {
    localStorage.setItem(AUTH_STORAGE_KEY, token)
  } else {
    localStorage.removeItem(AUTH_STORAGE_KEY)
  }
}

export function clearStoredAuthToken() {
  localStorage.removeItem(AUTH_STORAGE_KEY)
}

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
  const token = getStoredAuthToken()
  const response = await fetch(fullUrl, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

export async function loginUser({ username, password }) {
  return requestJson('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export async function getCurrentUser() {
  return requestJson('/api/auth/me', { method: 'GET' })
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

export async function createMercadoPagoPreference(orderId) {
  return requestJson('/api/payments/mercadopago/preference', {
    method: 'POST',
    body: JSON.stringify({ orderId }),
  })
}

// Extrai os campos de QR PIX de diferentes estruturas que o backend pode retornar
export function extractPixQrData(data) {
  // Tenta campos diretos (backend normalizado)
  const qrCode =
    data?.qrCode ??
    data?.qr_code ??
    data?.point_of_interaction?.transaction_data?.qr_code ??
    data?.transaction_data?.qr_code ??
    ''
  const qrCodeBase64 =
    data?.qrCodeBase64 ??
    data?.qr_code_base64 ??
    data?.point_of_interaction?.transaction_data?.qr_code_base64 ??
    data?.transaction_data?.qr_code_base64 ??
    ''
  const expiresIn = data?.expiresIn ?? data?.expires_in ?? data?.date_of_expiration ?? 1800
  return { qrCode, qrCodeBase64, expiresIn }
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
