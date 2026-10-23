export type Id = number | string;
export type Periodo = "dia" | "semana" | "mes";
export type Usuario = { id: Id; usuario: string };
export type BusAdmin = {
  id: Id;
  codigo_bus: string;
  capacidad: number;
  origen: string;
  destino: string;
};
export type Operacion = {
  bus_id: Id;
  iniciado_en: string;
  corte_evento_id: Id;
};
export type Totales = {
  entradas_originales: number;
  salidas_originales: number;
  ajuste_entradas: number;
  ajuste_salidas: number;
  entradas: number;
  salidas: number;
  ingresos_centavos: number;
  sin_recorrido: number;
};
export type Resumen = {
  bus: { id: Id; codigo_bus: string };
  periodo: Periodo;
  fecha: string;
  desde: string;
  hasta: string;
  zona_horaria: string;
  operacion: Operacion | null;
  tarifa_centavos: number | null;
  dias: (Totales & { fecha: string })[];
  totales: Totales;
  pagos_confirmados: null;
  deduplicacion_garantizada: false;
};
export type Recorrido = {
  id: Id;
  bus_id: Id;
  origen: string;
  destino: string;
  iniciado_en: string;
  finalizado_en: string | null;
  entradas: number;
  salidas: number;
  ingresos_centavos: number;
};
export type EventoAdmin = {
  evento_id: Id;
  bus_id: Id;
  recorrido_efectivo: Id | null;
  recibido_en: string;
  tarifa_centavos: number;
  tipo_evento: string;
  delta: number | string;
};
export type EventoHistorico = {
  id: Id;
  tipo_evento: string;
  cantidad_actual: number;
  fecha_hora: string;
};
export type Ajuste = {
  id: Id;
  tipo: string;
  delta: number | null;
  recorrido_id: Id | null;
  motivo: string;
  creado_en: string;
  usuario: string;
};
