const formatters = {
  GTQ: new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ', currencyDisplay: 'narrowSymbol' }),
  USD: new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol' }),
};

export function portfolioCurrency(client) {
  return client.tipo_cartera === 'edificios' ? 'USD' : 'GTQ';
}

export function formatPortfolioMoney(amount, currency) {
  return formatters[currency].format(amount);
}
