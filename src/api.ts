import type { State } from "./domain";
export type Profile = { uuid: string; name: string; email: string };
export type Option = { uuid: string; name: string };
export type Catalog = {
  categories: Option[];
  amenities: Option[];
  settings: Option[];
  contactTypes: Option[];
  currencies: (Option & { isoCode: string })[];
};
export type City = {
  uuid: string;
  name: string;
  divisionName: string;
  countryName: string;
};
export type Content = {
  name: string;
  description: string;
  categoryUuid: string;
  cityUuid: string | null;
  cityName: string;
  streetAddress: string;
  addressNumber: string;
  addressComplement: string;
  neighborhood: string;
  postalCode: string;
  locationNotes: string;
  latitude: number | null;
  longitude: number | null;
  altitudeMeters: number | null;
  startingPricePerNight: number | null;
  currencyUuid: string | null;
  amenityUuids: string[];
  settingUuids: string[];
  contacts: { typeUuid: string; value: string }[];
  photos: { url: string; description: string }[];
};
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
let csrf: { headerName: string; token: string } | undefined;
async function call<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = {};
  if (method !== "GET") {
    if (!csrf) csrf = await call("/auth/csrf");
    headers[csrf!.headerName] = csrf!.token;
    if (!(body instanceof FormData))
      headers["Content-Type"] = "application/json";
  }
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      headers,
      body:
        body === undefined
          ? undefined
          : body instanceof FormData
            ? body
            : JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    throw new ApiError(
      0,
      method === "GET"
        ? "Não foi possível conectar à API. Tente novamente."
        : "Não foi possível confirmar a operação. Atualize os dados antes de tentar novamente.",
    );
  }
  if (!response.ok) {
    if (
      (response.status === 401 || response.status === 403) &&
      path.startsWith("/admin/")
    ) {
      csrf = undefined;
      window.dispatchEvent(new Event("manager-session-expired"));
    }
    const problem = await response.json().catch(() => ({}));
    const message =
      response.status === 401
        ? "E-mail ou senha inválidos, ou sessão expirada."
        : response.status === 403
          ? "Acesso restrito a administradores com e-mail confirmado. Entre novamente."
          : response.status === 429
            ? "Muitas tentativas. Aguarde um minuto."
            : response.status === 503
              ? "Envio de e-mail indisponível no momento."
              : response.status >= 500
                ? "O serviço está indisponível. Tente novamente."
                : problem.detail || "Confira os dados e tente novamente.";
    throw new ApiError(response.status, message);
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
export type Collection = "requests" | "campings" | "reviews" | "users" | "history";
export type Page<T> = { items: T[]; page: number; totalElements: number; totalPages: number };
export type Filters = { page?: number; size?: number; query?: string; status?: string; kind?: string; id?: string; userId?: string; ownerId?: string; from?: string; to?: string };
export type Summary = { pending: number; reviews: number; published: number; drafts: number; kinds: Record<string, number> };
export async function page<T>(collection: Collection, filters: Filters = {}): Promise<Page<T>> {
  const params = new URLSearchParams(Object.entries(filters).map(([key,value]) => [key,String(value)]));
  return call(`/admin/${collection}?${params}`);
}
export const api = {
  async session() {
    await call("/admin/me");
    return call<Profile>("/users/me");
  },
  async login(email: string, password: string) {
    csrf = undefined;
    await call("/auth/login", "POST", { email, password });
    csrf = undefined;
    return this.session();
  },
  async logout() {
    try {
      await call("/auth/logout", "POST");
    } finally {
      csrf = undefined;
    }
  },
  recover: (email: string) =>
    call("/auth/password-recovery", "POST", { email }),
  page,
  async summary(): Promise<Summary> {
    const [suggestion, registration, claim, reviews, published, drafts] = await Promise.all([
      ...["suggestion", "registration", "claim"].map(kind => page("requests", { size: 1, status: "pending_review", kind })),
      page("reviews", {size: 1, status: "pending"}), page("campings", {size: 1, status: "published"}), page("campings", {size: 1, status: "draft"}),
    ]);
    return { pending: suggestion.totalElements + registration.totalElements + claim.totalElements, reviews: reviews.totalElements, published: published.totalElements, drafts: drafts.totalElements,
      kinds: { suggestion: suggestion.totalElements, registration: registration.totalElements, claim: claim.totalElements } };
  },
  async load(route: string): Promise<State> {
    const state: State = {requests: [], camps: [], reviews: [], users: []};
    const [section,id] = route.split("/").filter(Boolean);
    if (!section) state.requests = (await page<State["requests"][number]>("requests", {status: "pending_review", size: 5})).items;
    if (id && id !== "novo") {
      if (section === "solicitacoes") {
        state.requests = (await page<State["requests"][number]>("requests", {id})).items;
        const request = state.requests[0];
        if(request?.userId) state.users = (await page<State["users"][number]>("users", {id: request.userId})).items;
        if(request?.campId) state.camps = (await page<State["camps"][number]>("campings", {id: request.campId})).items;
      }
      if (section === "campings") state.camps = (await page<State["camps"][number]>("campings", {id})).items;
      if (section === "usuarios") state.users = (await page<State["users"][number]>("users", {id})).items;
    }
    return state;
  },
  catalog: () => call<Catalog>("/campsite-options"),
  cities: async (query: string) =>
    (
      await call<{ items: City[] }>(
        `/cities?query=${encodeURIComponent(query)}&size=50`,
      )
    ).items,
  decide: (kind: string, id: string, body: unknown) =>
    call(`/admin/requests/${kind}/${id}/decision`, "POST", body),
  save: (id: string | undefined, revision: number, content: Content) =>
    call<{ id: string }>(
      `/admin/campings${id ? "/" + id : ""}`,
      id ? "PUT" : "POST",
      { revision, content },
    ),
  campStatus: (id: string, revision: number, status: string) =>
    call(`/admin/campings/${id}/status`, "POST", { revision, status }),
  reviewStatus: (id: string, revision: number, status: string) =>
    call(`/admin/reviews/${id}/status`, "POST", { revision, status }),
  async upload(file: File) {
    const form = new FormData();
    form.append("photo", file);
    return call<{ url: string; description: string }>(
      "/admin/photos",
      "POST",
      form,
    );
  },
};
export const emptyContent = (): Content => ({
  name: "",
  description: "",
  categoryUuid: "",
  cityUuid: null,
  cityName: "",
  streetAddress: "",
  addressNumber: "",
  addressComplement: "",
  neighborhood: "",
  postalCode: "",
  locationNotes: "",
  latitude: null,
  longitude: null,
  altitudeMeters: null,
  startingPricePerNight: null,
  currencyUuid: null,
  amenityUuids: [],
  settingUuids: [],
  contacts: [],
  photos: [],
});
