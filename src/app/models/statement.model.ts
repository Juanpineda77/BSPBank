export interface Movimiento {
  fecha?: string;
  descripcion?: string;
  /** 'transferencia_entrada' | 'transferencia_salida' | … */
  tipo?: string;
  monto?: number;
}

export interface Statement {
  nombre?: string;
  cuenta?: number;
  saldo?: number;
  movimientos: Movimiento[];
}
