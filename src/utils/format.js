export function money(v) {
  return '$' + Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function round2(v) {
  return Math.round(v * 100) / 100;
}

export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function rand(min, max) {
  return Math.random() * (max - min) + min;
}

export function capArray(arr, max) {
  if (arr.length > max) arr.splice(0, arr.length - max);
}

export function pctText(v) {
  return `${v >= 0 ? '+' : ''}${(v * 100).toFixed(2)}%`;
}
