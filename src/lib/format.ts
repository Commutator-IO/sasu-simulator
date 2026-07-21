const euro = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const euroPrecis = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const nombre = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

export const eur = (v: number) => euro.format(Math.round(v));
export const eurPrecis = (v: number) => euroPrecis.format(v);
export const num = (v: number) => nombre.format(v);

export const pct = (v: number, decimales = 1) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'percent',
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(v);

/** Contribution rate: "8,55 %", without trailing zeros. */
export const tauxPct = (v: number) =>
  `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 }).format(v)} %`;
