export const DEFAULT_DAEMON_PORT = 3456;

export function getDaemonPort() {
  const port = parseInt(process.env.DAEMON_PORT || '', 10);
  return Number.isFinite(port) ? port : DEFAULT_DAEMON_PORT;
}

export function getDaemonUrl() {
  return `http://127.0.0.1:${getDaemonPort()}`;
}
