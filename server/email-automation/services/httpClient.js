async function httpJson(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        }
    });

    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    const payload = isJson ? await response.json() : await response.text();

    if (!response.ok) {
        const err = new Error(`HTTP ${response.status} ${response.statusText}`);
        err.status = response.status;
        err.payload = payload;
        throw err;
    }

    return payload;
}

module.exports = { httpJson };

