export interface CreditOffer {
  id: number;
  titulo: string;
  monto: number;
  interes: number;
}

export interface CreditRequest {
  offerId: number;
  monto: number;
}

export interface CreditRequestResponse {
  message: string;
  estado: "aprobado" | "rechazado" | "pendiente";
  solicitudId: number;
  limite_aprobado: number;
}

export interface CreditHistoryItem {
  id_solicitud: number;
  id_oferta: number;
  monto: number;
  estado: string;
  fecha: string;
  oferta: string;
  tasa_interes: number;
  plazo_meses: number;
}
