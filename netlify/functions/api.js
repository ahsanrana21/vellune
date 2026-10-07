const { getStore } = require('@netlify/blobs');

const store = () => getStore({ name: 'vellune-store', consistency: 'strong' });

async function readOrders() {
  return (await store().get('orders', { type: 'json' })) || [];
}

async function writeOrders(orders) {
  await store().setJSON('orders', orders);
  return orders;
}

function json(data, status = 200) {
  return { statusCode: status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(data) };
}

exports.handler = async (event) => {
  try {
    const path = (event.path || '').replace(/^.*\/\.netlify\/functions\/api\/?/, '').replace(/^\/api\/?/, '');
    const method = event.httpMethod || 'GET';

    if (path === 'health' || path === '') return json({ ok: true, service: 'vellune-api' });

    if (path === 'orders' && method === 'GET') return json({ ok: true, orders: await readOrders() });

    if (path === 'orders' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      if (!body.name || !body.ph || !body.c || !body.a || !Array.isArray(body.items) || !body.items.length) {
        return json({ ok: false, error: 'Missing required order information.' }, 400);
      }
      const orders = await readOrders();
      const id = body.id || ('VL' + Date.now().toString().slice(-8));
      const order = {
        id, items: body.items, pn: body.pn || body.items.map(x => `${x.name} x ${x.q}`).join(', '),
        total: Number(body.total || 0), name: String(body.name), ph: String(body.ph),
        c: String(body.c), a: String(body.a), no: String(body.no || ''),
        st: 'Pending', d: new Date().toLocaleString('en-PK', { timeZone: 'Asia/Karachi' }),
        createdAt: new Date().toISOString()
      };
      orders.unshift(order);
      await writeOrders(orders);
      return json({ ok: true, order });
    }

    if (path.startsWith('orders/') && method === 'PATCH') {
      const id = decodeURIComponent(path.slice('orders/'.length));
      const body = JSON.parse(event.body || '{}');
      const orders = await readOrders();
      const o = orders.find(x => x.id === id);
      if (!o) return json({ ok: false, error: 'Order not found.' }, 404);
      if (body.status) o.st = body.status;
      await writeOrders(orders);
      return json({ ok: true, order: o });
    }

    if (path.startsWith('orders/') && method === 'DELETE') {
      const id = decodeURIComponent(path.slice('orders/'.length));
      const orders = await readOrders();
      const next = orders.filter(x => x.id !== id);
      await writeOrders(next);
      return json({ ok: true });
    }

    return json({ ok: false, error: 'Not found' }, 404);
  } catch (e) {
    console.error(e);
    return json({ ok: false, error: e.message || 'Server error' }, 500);
  }
};
