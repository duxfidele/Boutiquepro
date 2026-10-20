export type BrowserCheckout = {
  id: string;
  integrationMode: 'redirect' | 'iframe';
  checkoutUrl: string;
  embedUrl: string | null;
};

export type CheckoutAttempt = {
  // Valeurs figées et enregistrées par votre serveur, jamais le corps du navigateur.
  mode: 'test' | 'live';
  idempotencyKey: string;
  request: {
    amount: number;
    currency: 'XOF';
    title: string;
    reference: string;
    integrationMode: 'redirect' | 'iframe';
    embedOrigin?: string;
    successUrl?: string;
    cancelUrl?: string;
    metadata: { orderId: string; storeId?: string; planKey?: string; [key: string]: any };
  };
  session: BrowserCheckout | null;
};

export async function createMonerizCheckout(
  attempt: CheckoutAttempt,
  saveSession: (session: BrowserCheckout) => Promise<void>,
): Promise<Response> {
  const headers = { 'Cache-Control': 'no-store' };
  if (attempt.session) {
    return Response.json(attempt.session, { headers });
  }

  const secret = process.env.MONERIZ_SECRET_KEY;
  if (!secret) {
    return Response.json({ error: { code: 'CHECKOUT_NOT_CONFIGURED' } }, { status: 503, headers });
  }

  try {
    const response = await fetch("https://api.moneriz.com/v1/checkout-sessions", {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + secret,
        'Content-Type': 'application/json',
        'Idempotency-Key': attempt.idempotencyKey,
      },
      body: JSON.stringify(attempt.request),
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });

    const result = await response.json();
    if (!response.ok) {
      const code = typeof result?.error?.code === 'string' ? result.error.code : 'MONERIZ_UNAVAILABLE';
      const param = typeof result?.error?.param === 'string' ? result.error.param : undefined;
      const retryAfter = response.headers.get('Retry-After');
      return Response.json({ error: { code, param } }, {
        // Un refus de la clé Moneriz concerne le marchand, pas la session du payeur.
        status: [401, 403].includes(response.status) ? 503 : response.status,
        headers: { ...headers, ...(retryAfter ? { 'Retry-After': retryAfter } : {}) },
      });
    }

    if (
      typeof result.id !== 'string' ||
      !result.id.startsWith('cs_') ||
      result.mode !== attempt.mode ||
      result.amount !== attempt.request.amount ||
      result.currency !== attempt.request.currency ||
      result.reference !== attempt.request.reference ||
      result.metadata?.orderId !== attempt.request.metadata.orderId ||
      result.integrationMode !== attempt.request.integrationMode ||
      !['redirect', 'iframe'].includes(result.integrationMode) ||
      typeof result.checkoutUrl !== 'string' ||
      (result.embedUrl !== null && typeof result.embedUrl !== 'string') ||
      (result.integrationMode === 'iframe' && !result.embedUrl)
    ) {
      throw new Error('Invalid checkout response');
    }

    const session: BrowserCheckout = {
      id: result.id,
      integrationMode: result.integrationMode,
      checkoutUrl: result.checkoutUrl,
      embedUrl: result.embedUrl,
    };

    // Le commit doit terminer avant de communiquer la session au navigateur.
    await saveSession(session);
    return Response.json(session, { status: 201, headers });
  } catch (error) {
    // La session a peut-être été créée : reprendre la même clé et le même JSON.
    return Response.json({ error: { code: 'CHECKOUT_RESULT_UNKNOWN' } }, { status: 503, headers });
  }
}
