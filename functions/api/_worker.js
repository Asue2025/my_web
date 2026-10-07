// Cloudflare Pages Function (functions/api/_worker.js)
// 页面调用：GET /api?action=list  、  POST /api?action=add
// KV 绑定名：MESSAGES
const MAX = 500;
const LIMIT = 100;
const PER_NAME = 20;

function json(data, status) {
  status = status || 200;
  return new Response(JSON.stringify(data), {
    status: status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const action = url.searchParams.get('action') || 'list';
    const kv = env.MESSAGES;
    if (!kv) {
      return json({ ok: false, error: 'kv not bound' }, 500);
    }

    if (action === 'list') {
      const raw = await kv.get('all');
      let all = [];
      try { all = raw ? JSON.parse(raw) : []; } catch (e) { all = []; }
      all.sort((a, b) => (b.ts || 0) - (a.ts || 0));
      return json(all.slice(0, LIMIT));
    }

    if (action === 'add' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch (e) { return json({ ok: false, error: 'bad json' }, 400); }
      let name = String((body && body.name) || '').trim();
      let text = String((body && body.text) || '').trim();
      if (!text) return json({ ok: false, error: '留言不能为空' }, 400);
      if (name.length > 30) name = name.slice(0, 30);
      if (text.length > 500) text = text.slice(0, 500);

      const raw = await kv.get('all');
      let all = [];
      try { all = raw ? JSON.parse(raw) : []; } catch (e) { all = []; }

      const nameCount = all.filter(m => m.name === name).length;
      if (nameCount >= PER_NAME) {
        all = all.filter(m => m.name !== name).sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, PER_NAME - 1);
      }

      all.push({ name: name || '匿名', text: text, ts: Math.floor(Date.now() / 1000) });
      if (all.length > MAX) all = all.slice(all.length - MAX);

      await kv.put('all', JSON.stringify(all));
      return json({ ok: true });
    }

    return json({ ok: false, error: 'not found' }, 404);
  }
}
