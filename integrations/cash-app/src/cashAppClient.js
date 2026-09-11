const API_HOSTS = {
  sandbox: 'https://sandbox.api.cash.app',
  production: 'https://api.cash.app',
};

export class CashAppClient {
  constructor({ env = 'sandbox', clientId, apiKeyId, apiKeySecret, region = 'PDX' }) {
    if (!clientId) throw new Error('CASH_APP_CLIENT_ID is required');
    this.env = env;
    this.baseUrl = API_HOSTS[env] ?? API_HOSTS.sandbox;
    this.clientId = clientId;
    this.apiKeyId = apiKeyId;
    this.apiKeySecret = apiKeySecret;
    this.region = region;
  }

  async createCustomerRequest({ actions, redirectUrl, referenceId }) {
    const body = {
      idempotency_key: crypto.randomUUID(),
      request: {
        actions,
        channel: 'ONLINE',
        redirect_url: redirectUrl,
        reference_id: referenceId,
      },
    };

    return this.#request('/customer-request/v1/requests', {
      method: 'POST',
      customerRequestApi: true,
      body,
    });
  }

  async retrieveCustomerRequest(requestId) {
    return this.#request(`/customer-request/v1/requests/${encodeURIComponent(requestId)}`, {
      method: 'GET',
      customerRequestApi: true,
    });
  }

  async retrieveCustomer(customerId) {
    return this.#request(`/network/v1/customers/${encodeURIComponent(customerId)}`);
  }

  async listCustomerGrants(customerId) {
    return this.#request(`/network/v1/customers/${encodeURIComponent(customerId)}/grants`);
  }

  async retrieveBalance(balanceId, grantId) {
    const qs = grantId ? `?grant_id=${encodeURIComponent(grantId)}` : '';
    return this.#request(`/network/v1/balances/${encodeURIComponent(balanceId)}${qs}`);
  }

  async listTransactions() {
    const error = new Error(
      'Cash App public partner docs do not currently expose a general consumer transaction-history endpoint.'
    );
    error.code = 'CASH_APP_TRANSACTION_HISTORY_UNAVAILABLE';
    throw error;
  }

  async #request(path, { method = 'GET', body, customerRequestApi = false } = {}) {
    const headers = {
      Accept: 'application/json',
      'User-Agent': 'OpenRabbit-CashApp-Connector/0.1',
      Authorization: customerRequestApi
        ? `Client ${this.clientId}`
        : `Client ${this.clientId} ${this.apiKeyId}`,
    };

    if (body) headers['Content-Type'] = 'application/json';

    if (!customerRequestApi) {
      headers['X-Region'] = this.region;
      // Sandbox explicitly permits this magic signature. Production signing is intentionally
      // blocked until partner credentials and the exact signing contract are enabled.
      if (this.env === 'sandbox') {
        headers['X-Signature'] = 'sandbox:skip-signature-check';
      } else {
        throw new Error('Production X-Signature generation is not enabled in this prototype.');
      }
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;

    if (!response.ok) {
      const error = new Error(`Cash App API request failed with ${response.status}`);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    return payload;
  }
}
