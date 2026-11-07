import type { Content } from "./api";
export type Kind = "suggestion" | "registration" | "claim";
export type RequestStatus =
  "pending_review" | "accepted" | "approved" | "rejected";
export type CampStatus =
  "draft" | "pending_review" | "published" | "rejected" | "archived";
export type History = { date: string; text: string };
export type Request = {
  userName?: string;
  uuid?: string;
  revision?: number;
  id: string;
  kind: Kind;
  name: string;
  userId: string;
  date: string;
  status: RequestStatus;
  location: string;
  instagram?: string;
  maps?: string;
  contact?: string;
  evidence?: string;
  campId?: string;
  notes: string;
  response: string;
  history: History[];
};
export type Camp = {
  ownerName?: string;
  content?: Content;
  revision?: number;
  id: string;
  name: string;
  city: string;
  category: string;
  status: CampStatus;
  description: string;
  address: string;
  contact: string;
  latitude: string;
  longitude: string;
  ownerId?: string;
  amenities: string[];
};
export type Review = {
  userName?: string;
  campName?: string;
  revision?: number;
  photos?: string[];
  id: string;
  campId: string;
  userId: string;
  date: string;
  rating: number;
  text: string;
  status: "pending" | "published" | "hidden";
};
export type User = {
  requestCount?: number;
  campCount?: number;
  id: string;
  name: string;
  email: string;
  city: string;
  joined: string;
};
export type State = {
  requests: Request[];
  camps: Camp[];
  reviews: Review[];
  users: User[];
};
export const kinds: Record<Kind, string> = {
  suggestion: "Indicação",
  registration: "Cadastro",
  claim: "Vínculo",
};
export const statuses: Record<string, string> = {
  pending_review: "Em análise",
  accepted: "Aceita",
  approved: "Aprovado",
  rejected: "Não aprovado",
  draft: "Rascunho",
  published: "Publicado",
  archived: "Arquivado",
  pending: "Pendente",
  hidden: "Oculta",
};
export const dateLabel = (date: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(date));
export function publicationError(camp: Camp): string {
  if (
    ![
      camp.name,
      camp.city,
      camp.category,
      camp.description,
      camp.address,
      camp.contact,
    ].every((value) => value.trim())
  )
    return "Preencha nome, cidade oficial, categoria, descrição, endereço e contato antes de publicar.";
  const lat = Number(camp.latitude),
    lng = Number(camp.longitude);
  if (
    !camp.latitude.trim() ||
    !camp.longitude.trim() ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  )
    return "Informe coordenadas válidas antes de publicar.";
  return "";
}
export function decide(
  state: State,
  id: string,
  action: "accept" | "reject",
  notes: string,
  response: string,
  draft?: Camp,
  existingId?: string,
): State {
  const request = state.requests.find((item) => item.id === id);
  if (!request || request.status !== "pending_review")
    throw new Error("Esta solicitação já foi analisada.");
  if (!response.trim())
    throw new Error("Escreva uma resposta ao solicitante antes de concluir.");
  if (response.length > 4000 || notes.length > 4000)
    throw new Error("Os textos devem ter até 4.000 caracteres.");
  let camps = state.camps.map((camp) => ({ ...camp }));
  let campId = request.campId;
  if (action === "accept") {
    if (request.kind === "suggestion") {
      if (existingId) {
        if (
          !camps.some(
            (camp) => camp.id === existingId && camp.status !== "archived",
          )
        )
          throw new Error("Selecione um camping disponível.");
        campId = existingId;
      } else {
        if (!draft?.city.trim() || !draft.category.trim() || !draft.name.trim())
          throw new Error(
            "Informe nome, cidade e categoria para criar o rascunho.",
          );
        camps = [...camps, { ...draft, status: "draft", ownerId: undefined }];
        campId = draft.id;
      }
    } else {
      const camp = camps.find((item) => item.id === campId);
      if (!camp) throw new Error("Camping não encontrado.");
      if (request.kind === "claim") {
        if (camp.status !== "published" || camp.ownerId)
          throw new Error(
            "Este camping não está disponível para um novo vínculo.",
          );
        camp.ownerId = request.userId;
      } else {
        const error = publicationError(camp);
        if (error) throw new Error(error);
        camp.status = "published";
      }
    }
  } else if (request.kind === "registration") {
    camps = camps.map((camp) =>
      camp.id === campId ? { ...camp, status: "rejected" } : camp,
    );
  }
  const date = new Date().toISOString();
  return {
    ...state,
    camps,
    requests: state.requests.map((item) => {
      if (item.id === id)
        return {
          ...item,
          campId,
          status:
            action === "reject"
              ? "rejected"
              : item.kind === "suggestion"
                ? "accepted"
                : "approved",
          notes: notes.trim(),
          response: response.trim(),
          history: [
            ...item.history,
            {
              date,
              text:
                action === "reject"
                  ? "Solicitação não aprovada pela equipe de demonstração."
                  : "Solicitação aprovada pela equipe de demonstração.",
            },
          ],
        };
      if (
        action === "accept" &&
        request.kind === "claim" &&
        item.kind === "claim" &&
        item.campId === campId &&
        item.status === "pending_review"
      )
        return {
          ...item,
          status: "rejected",
          response:
            "Outro vínculo de propriedade foi aprovado para este camping.",
          history: [
            ...item.history,
            { date, text: "Encerrada após aprovação de outro vínculo." },
          ],
        };
      return item;
    }),
  };
}
