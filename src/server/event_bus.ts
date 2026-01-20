type EventPayload = {
  channel: string;
  args: unknown[];
};

const MAX_QUEUE_LENGTH = 500;

const queues = new Map<string, EventPayload[]>();
const subscribers = new Map<string, Set<(payload: EventPayload) => void>>();

function enqueue(clientId: string, payload: EventPayload) {
  const queue = queues.get(clientId) ?? [];
  queue.push(payload);
  if (queue.length > MAX_QUEUE_LENGTH) {
    queue.shift();
  }
  queues.set(clientId, queue);
}

export function publishToClient(clientId: string, payload: EventPayload) {
  const subs = subscribers.get(clientId);
  if (subs && subs.size > 0) {
    for (const handler of subs) {
      handler(payload);
    }
    return;
  }
  enqueue(clientId, payload);
}

export function broadcast(payload: EventPayload) {
  const clientIds = new Set<string>([
    ...subscribers.keys(),
    ...queues.keys(),
  ]);
  if (clientIds.size === 0) return;
  for (const clientId of clientIds) {
    publishToClient(clientId, payload);
  }
}

export function subscribeToClient(
  clientId: string,
  handler: (payload: EventPayload) => void,
) {
  const subs = subscribers.get(clientId) ?? new Set();
  subs.add(handler);
  subscribers.set(clientId, subs);

  const queued = queues.get(clientId);
  if (queued && queued.length > 0) {
    for (const payload of queued) {
      handler(payload);
    }
    queues.delete(clientId);
  }

  return () => {
    const current = subscribers.get(clientId);
    if (!current) return;
    current.delete(handler);
    if (current.size === 0) {
      subscribers.delete(clientId);
    }
  };
}
