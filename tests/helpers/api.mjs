export function api(baseUrl) {
  return {
    async request(method, urlPath, { token, json, headers } = {}) {
      const res = await fetch(`${baseUrl}${urlPath}`, {
        method,
        headers: {
          ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...headers,
        },
        body: json !== undefined ? JSON.stringify(json) : undefined,
      });
      const text = await res.text();
      let body = null;
      if (text) {
        try {
          body = JSON.parse(text);
        } catch {
          body = text;
        }
      }
      return { status: res.status, body, text };
    },
    get(urlPath, opts) {
      return this.request('GET', urlPath, opts);
    },
    post(urlPath, json, opts = {}) {
      return this.request('POST', urlPath, { ...opts, json });
    },
    patch(urlPath, json, opts = {}) {
      return this.request('PATCH', urlPath, { ...opts, json });
    },
    del(urlPath, opts = {}) {
      return this.request('DELETE', urlPath, opts);
    },
  };
}
