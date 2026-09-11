export function normalizeCashAppBalance({ balance, customer }) {
  return {
    provider: 'cash_app',
    external_account_id: balance?.id ?? null,
    account_name: 'Cash App Checking',
    account_type: 'checking',
    currency: balance?.currency ?? 'USD',
    current_balance: typeof balance?.amount === 'number' ? balance.amount / 100 : null,
    owner_reference: customer?.reference_id ?? null,
    cashtag: customer?.cashtag ?? null,
    source_updated_at: balance?.updated_at ?? null,
  };
}

export function normalizeCashAppTransaction(tx) {
  return {
    provider: 'cash_app',
    external_transaction_id: tx.id,
    posted_at: tx.posted_at ?? tx.created_at ?? null,
    amount: tx.amount,
    currency: tx.currency ?? 'USD',
    description: tx.description ?? null,
    merchant_name: tx.merchant_name ?? null,
    direction: tx.direction ?? null,
    raw: tx,
  };
}
