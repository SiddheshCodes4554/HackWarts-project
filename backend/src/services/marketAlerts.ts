type MarketAlertSubscription = {
  id: string;
  commodity: string;
  targetPrice: number;
  contact: string;
  createdAt: string;
};

const subscriptions = new Map<string, MarketAlertSubscription>();

function makeId(): string {
  return `alert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function addMarketAlertSubscription(subscription: Omit<MarketAlertSubscription, "id" | "createdAt">): MarketAlertSubscription {
  const record: MarketAlertSubscription = {
    id: makeId(),
    createdAt: new Date().toISOString(),
    ...subscription,
  };
  subscriptions.set(record.id, record);
  return record;
}

export function listMarketAlertSubscriptions(): MarketAlertSubscription[] {
  return Array.from(subscriptions.values());
}
