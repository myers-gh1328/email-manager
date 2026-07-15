export function isLoopbackHost(host: string) {
  return ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(host.trim().toLowerCase());
}
