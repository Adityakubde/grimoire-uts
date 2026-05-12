export async function apiRequest(path, options = {}) {
  const { token, tokenProvider, body, headers, ...rest } = options;
  const hasBody = body !== undefined;
  const resolvedToken = tokenProvider ? await tokenProvider() : token;

  // API helper attaches the Firebase JWT whenever a route needs login.
  const response = await fetch(path, {
    ...rest,
    headers: {
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...(resolvedToken ? { Authorization: `Bearer ${resolvedToken}` } : {}),
      ...(headers || {}),
    },
    body: hasBody ? JSON.stringify(body) : undefined,
  });

  let payload = {};
  try {
    payload = await response.json();
  } catch (error) {
    payload = {};
  }

  if (!response.ok) {
    throw new Error(payload.error || 'Request failed.');
  }

  return payload.data;
}
