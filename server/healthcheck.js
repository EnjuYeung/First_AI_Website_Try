const baseUrl = `http://127.0.0.1:${process.env.PORT || 3001}`;

try {
  const [health, entry] = await Promise.all([
    fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(3000) }),
    fetch(`${baseUrl}/`, { signal: AbortSignal.timeout(3000) }),
  ]);
  if (!health.ok || (await health.json()).status !== 'ok' || !entry.ok ||
      !entry.headers.get('content-type')?.startsWith('text/html') ||
      !(await entry.text()).includes('/assets/')) {
    throw new Error('unhealthy');
  }
} catch {
  console.error('Application health check failed');
  process.exitCode = 1;
}
