const ordersBody = document.querySelector('#orders-body');
const message = document.querySelector('#form-message');
const form = document.querySelector('#order-form');

function formatDate(value) {
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date(value));
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
function renderOrders(orders) {
  if (!orders.length) {
    ordersBody.innerHTML = '<tr><td colspan="6" class="empty">No orders yet. Create your first order.</td></tr>';
  } else {
    ordersBody.innerHTML = orders.map((order) => `
      <tr>
        <td>#ORD-${String(order.id).padStart(3, '0')}</td>
        <td>${escapeHtml(order.studentId)}</td>
        <td>#${order.itemId}</td>
        <td>${order.qty}</td>
        <td><span class="status ${escapeHtml(order.status)}">${escapeHtml(order.status)}</span></td>
        <td>${formatDate(order.createdAt)}</td>
      </tr>`).join('');
  }
  const placed = orders.filter((o) => o.status === 'placed').length;
  const preparing = orders.filter((o) => o.status === 'preparing').length;
  const completed = orders.filter((o) => ['ready', 'completed'].includes(o.status)).length;
  document.querySelector('#total-stat').textContent = orders.length;
  document.querySelector('#placed-stat').textContent = placed;
  document.querySelector('#progress-stat').textContent = preparing;
  document.querySelector('#completed-stat').textContent = completed;
  document.querySelector('#nav-count').textContent = orders.length;
  document.querySelector('#showing-count').textContent = `Showing ${orders.length} order${orders.length === 1 ? '' : 's'}`;
}
async function loadOrders() {
  ordersBody.innerHTML = '<tr><td colspan="6" class="empty">Loading orders…</td></tr>';
  try {
    const response = await fetch('/orders');
    if (!response.ok) throw new Error('Could not load orders.');
    renderOrders(await response.json());
  } catch (error) {
    ordersBody.innerHTML = `<tr><td colspan="6" class="empty">${escapeHtml(error.message)}</td></tr>`;
  }
}

document.querySelector('#refresh').addEventListener('click', loadOrders);
document.querySelector('#focus-form').addEventListener('click', () => {
  document.querySelector('#create-panel').scrollIntoView({ behavior: 'smooth', block: 'center' });
  document.querySelector('#studentId').focus({ preventScroll: true });
});
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  message.className = 'form-message';
  message.textContent = '';
  const payload = {
    studentId: form.elements.studentId.value.trim(),
    itemId: Number(form.elements.itemId.value),
    qty: Number(form.elements.qty.value),
  };
  const button = document.querySelector('#submit-button');
  button.disabled = true;
  button.textContent = 'Creating…';
  try {
    const response = await fetch('/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) {
      const details = result.details?.map((item) => item.message).join(' ');
      throw new Error(details || result.message || result.error || 'Could not create order.');
    }
    message.textContent = `Order #ORD-${String(result.id).padStart(3, '0')} created successfully.`;
    form.reset();
    await loadOrders();
  } catch (error) {
    message.className = 'form-message error';
    message.textContent = error.message;
  } finally {
    button.disabled = false;
    button.innerHTML = 'Create order <span>→</span>';
  }
});

loadOrders();
