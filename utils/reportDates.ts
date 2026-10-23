export const money = (centavos: number) => `Q${(centavos / 100).toFixed(2)}`;
export function todayGuatemala(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Guatemala",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) =>
    parts.find((value) => value.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function localDateTime(value: string) {
  const date = new Date(`${value.replace(" ", "T")}Z`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("es-GT", { timeZone: "America/Guatemala" });
}
export function fareCents(input: string) {
  if (!/^\d{1,4}(?:[.,]\d{1,2})?$/.test(input.trim()))
    throw new Error("Ingrese una tarifa de Q0 a Q1000 con hasta dos decimales");
  const value = Math.round(Number(input.replace(",", ".")) * 100);
  if (value > 100000) throw new Error("La tarifa maxima es Q1000");
  return value;
}
