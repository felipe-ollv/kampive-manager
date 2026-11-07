import React, { useEffect, useState, useCallback, useRef } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/plus-jakarta-sans";
import "./styles.css";
import { api, type Profile, type Catalog, type Summary } from "./api";
import { Access, CampEditor, CityPicker } from "./connected";
import {
  dateLabel,
  kinds,
  statuses,
  type Kind,
  type Request,
  type State,
} from "./domain";
import { Avatar, Badge, Empty, Icon, Modal, type IconName } from "./ui";

import { Pagination, RefreshContext, usePage } from "./pagination";

const go = (path: string) => {
  window.location.hash = path;
};
function useRoute() {
  const [route, setRoute] = useState(window.location.hash.slice(1) || "/");
  useEffect(() => {
    const update = () => {
      setRoute(window.location.hash.slice(1) || "/");
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  return route;
}
const nav: { path: string; label: string; icon: IconName }[] = [
  { path: "/", label: "Visão geral", icon: "grid" },
  { path: "/solicitacoes", label: "Solicitações", icon: "inbox" },
  { path: "/campings", label: "Campings", icon: "tent" },
  { path: "/avaliacoes", label: "Avaliações", icon: "star" },
  { path: "/usuarios", label: "Usuários", icon: "users" },
];
function App() {
  const route = useRoute();
  const [state, setState] = useState<State>({
    requests: [],
    camps: [],
    reviews: [],
    users: [],
  });
  const [profile, setProfile] = useState<Profile | null>(null);
  const [catalog, setCatalog] = useState<Catalog>({
    categories: [],
    amenities: [],
    settings: [],
    contactTypes: [],
    currencies: [],
  });
  const [authLoading, setAuthLoading] = useState(true),
    [loading, setLoading] = useState(false),
    [loadError, setLoadError] = useState(""),
    [sessionMessage, setSessionMessage] = useState("");
  const epoch = useRef(0);
  const [revision, setRevision] = useState(0);
  const [summary, setSummary] = useState<Summary>({pending:0,reviews:0,published:0,drafts:0,kinds:{}});
  const currentRoute = useRef(route);
  currentRoute.current = route;
  const reload = useCallback(async () => {
    const generation = ++epoch.current;
    setLoading(true);
    setLoadError("");
    try {
      const [data, options, totals] = await Promise.all([api.load(currentRoute.current), api.catalog(), api.summary()]);
      if (epoch.current === generation) {
        setState(data);
        setCatalog(options);
        setSummary(totals);
        setRevision(value => value+1);
      }
    } catch (cause) {
      if (epoch.current === generation) setLoadError((cause as Error).message);
      throw cause;
    } finally {
      if (epoch.current === generation) setLoading(false);
    }
  }, []);
  useEffect(() => {
    let active = true;
    const expired = () => {
      epoch.current++;
      setProfile(null);
      setState({ requests: [], camps: [], reviews: [], users: [] });
      setLoading(false);
      setSessionMessage(
        "Sua sessão expirou ou o acesso foi revogado. Entre novamente.",
      );
    };
    window.addEventListener("manager-session-expired", expired);
    api
      .session()
      .then(async (user) => {
        if (active) {
          setProfile(user);
          setSessionMessage("");

        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setAuthLoading(false);
      });
    return () => {
      active = false;
      window.removeEventListener("manager-session-expired", expired);
    };
  }, [reload]);
  useEffect(() => {
    if (profile) void reload().catch(() => {});
  }, [route, profile, reload]);
  const signedIn = async (user: Profile) => {
    epoch.current++;
    setProfile(user);
    setSessionMessage("");
    go("/");
  };
  const logout = async () => {
    try {
      await api.logout();
      epoch.current++;
      setProfile(null);
      setState({ requests: [], camps: [], reviews: [], users: [] });
      go("/login");
    } catch (cause) {
      setLoadError((cause as Error).message);
    }
  };
  const [menu, setMenu] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(timer);
  }, [notice]);
  const notify = (text: string) => setNotice(text);
  const pending = summary.pending;
  const active = nav.find((item) =>
    item.path === "/" ? route === "/" : route.startsWith(item.path),
  );
  const request = state.requests.find(
    (item) => route === `/solicitacoes/${item.id}`,
  );
  const camp = state.camps.find((item) => route === `/campings/${item.id}`);
  const user = state.users.find((item) => route === `/usuarios/${item.id}`);
  if (authLoading)
    return (
      <div className="empty" role="status">
        Verificando acesso administrativo…
      </div>
    );
  if (!profile)
    return (
      <Access
        key={route}
        recovery={route === "/recuperar-acesso"}
        onLogin={signedIn}
        message={sessionMessage}
      />
    );
  return (
    <div className="app">
      <a
        className="skip"
        href="#main"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main")?.focus();
        }}
      >
        Pular para conteúdo
      </a>
      {menu && (
        <button
          className="scrim"
          onClick={() => setMenu(false)}
          aria-label="Fechar navegação"
        />
      )}
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <a className="brand" href="#/">
          <img src={`${import.meta.env.BASE_URL}brand.webp`} alt="" />
          <span>
            kampive<small>GESTÃO</small>
          </span>
        </a>
        <span className="nav-label">ESPAÇO DE TRABALHO</span>
        <nav aria-label="Navegação principal">
          {nav.map((item) => (
            <a
              key={item.path}
              href={`#${item.path}`}
              className={active?.path === item.path ? "active" : ""}
              aria-current={active?.path === item.path ? "page" : undefined}
              onClick={() => setMenu(false)}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
              {item.path === "/solicitacoes" && pending > 0 && <b>{pending}</b>}
              {item.path === "/avaliacoes" && (
                <small>
                  {
                    summary.reviews
                  }
                </small>
              )}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="workspace-note">
            <Icon name="leaf" />
            <strong>Cuidar de cada destino.</strong>
            <p>Uma comunidade melhor começa com boas conexões.</p>
          </div>
          <button className="profile-button" onClick={() => void logout()}>
            <Avatar name={profile.name} />
            <span>
              <strong>{profile.name}</strong>
              <small>Administrador · Sair</small>
            </span>
            <Icon name="logout" size={17} />
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="topbar-location">
            <button
              className="icon-button mobile-menu"
              onClick={() => setMenu(!menu)}
              aria-label="Abrir navegação"
              aria-expanded={menu}
            >
              <Icon name="menu" />
            </button>
            <span>Workspace</span>
            <span className="slash">/</span>
            <strong>{active?.label || "Gestão"}</strong>
          </div>
          <div className="topbar-right">
            <span className="demo-label">
              <i />
              API local conectada
            </span>
            <button
              className="text-button"
              disabled={loading}
              onClick={() => void reload().catch(() => {})}
            >
              Atualizar dados
            </button>
            <Avatar name={profile.name} />
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          <div className="demo-banner">
            <Icon name="leaf" size={16} />
            <span>
              Ambiente local · solicitações e decisões reais do aplicativo.
            </span>
          </div>
          {loadError && (
            <div className="error" role="alert">
              {loadError}{" "}
              <button
                className="text-button"
                onClick={() => void reload().catch(() => {})}
              >
                Tentar novamente
              </button>
            </div>
          )}
          {loading && <p role="status">Atualizando dados…</p>}
          <RefreshContext.Provider value={revision}><div aria-busy={loading} inert={loading}>
            {route === "/" ? (
              <Dashboard state={state} summary={summary} />
            ) : route === "/solicitacoes" ? (
              <Requests />
            ) : request ? (
              <RequestDetail
                key={`${request.id}:${request.revision}`}
                request={request}
                catalog={catalog}
                state={state}
                update={reload}
                notify={notify}
              />
            ) : route === "/campings" ? (
              <Camps />
            ) : camp || route === "/campings/novo" ? (
              <CampEditor
                key={`${camp?.id || "new"}:${camp?.revision || 0}`}
                camp={camp}
                catalog={catalog}
                reload={reload}
                notify={notify}
              />
            ) : route === "/avaliacoes" ? (
              <Reviews update={reload} notify={notify} />
            ) : route === "/usuarios" ? (
              <Users />
            ) : user ? (
              <>
                <PageHead
                  eyebrow="COMUNIDADE"
                  title={user.name}
                  description="Perfil e contribuições para apoiar a análise."
                  back="/usuarios"
                />
                <div className="detail-grid">
                  <section className="panel">
                    <h2>Dados do usuário</h2>
                    <dl className="facts">
                      <div>
                        <dt>E-mail</dt>
                        <dd>{user.email}</dd>
                      </div>
                      <div>
                        <dt>Cidade</dt>
                        <dd>{user.city}</dd>
                      </div>
                      <div>
                        <dt>Na comunidade desde</dt>
                        <dd>{dateLabel(user.joined)}</dd>
                      </div>
                    </dl>
                    <h2>Solicitações</h2>
                    <UserRequests userId={user.id} />
                  </section>
                  <section className="panel">
                    <h2>Vínculos aprovados</h2>
                    <UserCamps userId={user.id} />
                  </section>
                </div>
              </>
            ) : (
              <Empty title="Página não encontrada">
                <a href="#/">Voltar para a visão geral</a>
              </Empty>
            )}
          </div>
          </RefreshContext.Provider><footer>
            Kampive Manager <span>Feito para cuidar da comunidade.</span>
          </footer>
        </main>
      </div>
      {notice && (
        <div className="toast" role="status">
          <Icon name="check" />
          {notice}
          <button
            onClick={() => setNotice("")}
            className="icon-button"
            aria-label="Dispensar mensagem"
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
function PageHead({
  eyebrow,
  title,
  description,
  action,
  back,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
  back?: string;
}) {
  return (
    <>
      <div className="page-head">
        {" "}
        <div>
          {back && (
            <a className="back" href={`#${back}`}>
              ← Voltar
            </a>
          )}
          <div className="eyebrow">{eyebrow}</div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {action}
      </div>
    </>
  );
}
function Dashboard({ state, summary }: { state: State; summary: Summary }) {
  const pending = state.requests
    .filter((item) => item.status === "pending_review")
    .sort((a, b) => a.date.localeCompare(b.date));
  const reviewCount = summary.reviews;
  return (
    <>
      <PageHead
        eyebrow="UM OLHAR SOBRE A COMUNIDADE"
        title="Cada solicitação, um novo destino."
        description="Acompanhe o que chegou e ajude a comunidade a ir mais longe."
        action={
          <a className="button" href="#/solicitacoes">
            Abrir fila de análise
            <Icon name="arrow" size={17} />
          </a>
        }
      />
      <div className="stats">
        {(
          [
            {
              label: "Solicitações em análise",
              value: summary.pending,
              sub: "Aguardando uma decisão",
              icon: "inbox",
              path: "/solicitacoes",
            },
            {
              label: "Campings publicados",
              value: summary.published,
              sub: "Disponíveis para explorar",
              icon: "tent",
              path: "/campings",
            },
            {
              label: "Avaliações pendentes",
              value: reviewCount,
              sub: "Vozes da nossa comunidade",
              icon: "star",
              path: "/avaliacoes",
            },
            {
              label: "Campings em rascunho",
              value: summary.drafts,
              sub: "Destinos em preparação",
              icon: "leaf",
              path: "/campings",
            },
          ] as const
        ).map((item, i) => (
          <a
            className={`stat stat-${i}`}
            href={`#${item.path}`}
            key={item.label}
          >
            <div className="stat-label">
              {item.label}
              <Icon name={item.icon} />
            </div>
            <strong>{String(item.value).padStart(2, "0")}</strong>
            <span>
              {item.sub}
              <Icon name="arrow" size={16} />
            </span>
          </a>
        ))}
      </div>
      <div className="overview-grid">
        <section className="panel queue">
          <div className="section-heading">
            <div>
              <h2>
                Precisam da sua atenção{" "}
                <span className="count">{summary.pending}</span>
              </h2>
              <p>As solicitações mais antigas aparecem primeiro.</p>
            </div>
            <a className="text-link" href="#/solicitacoes">
              Ver todas
              <Icon name="arrow" size={16} />
            </a>
          </div>
          <RequestTable rows={pending.slice(0, 5)} compact />
        </section>
        <aside className="overview-aside">
          <section className="panel distribution">
            <div className="section-heading">
              <h2>Na fila de análise</h2>
              <Icon name="clock" />
            </div>
            {(["suggestion", "registration", "claim"] as Kind[]).map((kind) => {
              const count = summary.kinds[kind] || 0;
              return (
                <div className="distribution-item" key={kind}>
                  <div>
                    <span>
                      {kind === "suggestion"
                        ? "Indicações"
                        : kind === "registration"
                          ? "Cadastros completos"
                          : "Vínculos de proprietário"}
                    </span>
                    <strong>{count}</strong>
                  </div>
                  <div className="track">
                    <span
                      style={{
                        width: `${summary.pending ? (count / summary.pending) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
            <p className="small muted">
              Uma boa análise faz a diferença na próxima aventura de alguém.
            </p>
          </section>
          <section className="journey-card">
            <Icon name="tent" size={35} />
            <h2>
              Da indicação à<br />
              próxima aventura.
            </h2>
            <p>
              Revise os dados, prepare o cadastro e publique novos lugares para
              explorar.
            </p>
            <a href="#/campings/novo">
              Cadastrar um camping
              <Icon name="arrow" size={17} />
            </a>
          </section>
        </aside>
      </div>
      <section className="workflow-strip">
        <span className="eyebrow">NOSSO CUIDADO, EM CADA ETAPA</span>
        <div>
          <span>
            <b>01</b> Receber
          </span>
          <i />
          <span>
            <b>02</b> Conferir
          </span>
          <i />
          <span>
            <b>03</b> Conectar
          </span>
          <i />
          <span>
            <b>04</b> Publicar
          </span>
        </div>
      </section>
    </>
  );
}
function RequestTable({
  rows,
  compact,
  message,
}: {
  rows: Request[];
  compact?: boolean;
  message?: string;
}) {
  if (!rows.length) return <Empty title={message} />;
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Solicitação</th>
            <th>Tipo</th>
            {!compact && <th>Solicitante</th>}
            <th>Recebida</th>
            <th>Status</th>
            <th>
              <span className="sr-only">Ações</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => (
            <tr key={item.id}>
              <td>
                <a className="cell-title" href={`#/solicitacoes/${item.id}`}>
                  {item.name}
                </a>
                <span className="cell-sub">
                  {item.id}
                  {!compact && ` · ${item.location}`}
                </span>
              </td>
              <td>
                <span className={`kind ${item.kind}`}>{kinds[item.kind]}</span>
              </td>
              {!compact && (
                <td>
                  {item.userName || "Equipe Kampive"}
                </td>
              )}
              <td className="nowrap">{dateLabel(item.date)}</td>
              <td>
                <Badge status={item.status} />
              </td>
              <td>
                <a
                  className="row-action"
                  href={`#/solicitacoes/${item.id}`}
                  aria-label={`Analisar ${item.name}`}
                >
                  <Icon name="arrow" size={18} />
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function Search({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="search">
      <Icon name="search" size={18} />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
function Requests() {
  const list = usePage<Request>("requests", {status: "pending_review"});
  const {kind="all", status="pending_review", query="", from="", to=""} = list.filters;
  const setKind = (kind: string) => list.change({kind});
  const setStatus = (status: string) => list.change({status});
  const setQuery = (query: string) => list.change({query});
  const setFrom = (from: string) => list.change({from});
  const setTo = (to: string) => list.change({to});
  const rows = list.loading || list.error ? [] : list.items;
  return (
    <>
      <PageHead
        eyebrow="CENTRAL DE ANÁLISE"
        title="Solicitações"
        description="Toda contribuição merece um olhar atento. Comece pelas mais antigas."
      />
      <section className="panel list-panel">
        <div className="tabs" aria-label="Tipo de solicitação">
          {[
            ["all", "Todas"],
            ["suggestion", "Indicações"],
            ["registration", "Cadastros"],
            ["claim", "Vínculos"],
          ].map(([value, label]) => (
            <button
              key={value}
              className={kind === value ? "selected" : ""}
              aria-pressed={kind === value}
              onClick={() => setKind(value)}
            >
              {label}

            </button>
          ))}
        </div>
        <div className="filters">
          <Search
            value={query}
            onChange={setQuery}
            placeholder="Buscar camping, pessoa ou protocolo"
          />
          <select
            aria-label="Status da solicitação"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="all">Todos os status</option>
            {["pending_review", "accepted", "approved", "rejected"].map(
              (value) => (
                <option key={value} value={value}>
                  {statuses[value]}
                </option>
              ),
            )}
          </select>
          <label className="date-filter">
            De
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
          </label>
          <label className="date-filter">
            Até
            <input
              type="date"
              min={from}
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </label>
        </div>
        {from && to && from > to ? (
          <p className="error">A data final deve ser posterior à inicial.</p>
        ) : (
          <RequestTable rows={rows} message={list.loading ? "Carregando…" : list.error ? "Não foi possível carregar a lista" : undefined} />
        )}
        <div className="table-footer">
          <Pagination list={list} />
          <button
            className="text-button"
            onClick={() => {
              list.change({kind:"all",status:"all",query:"",from:"",to:""});
            }}
          >
            Limpar filtros
          </button>
        </div>
      </section>
    </>
  );
}
function RequestDetail({
  request,
  catalog,
  state,
  update,
  notify,
}: {
  request: Request;
  catalog: Catalog;
  state: State;
  update: () => Promise<void>;
  notify: (text: string) => void;
}) {
  const [notes, setNotes] = useState(request.notes),
    [response, setResponse] = useState(request.response),
    [mode, setMode] = useState("new"),
    [existing, setExisting] = useState(""),
    [city, setCity] = useState(""),
    [category, setCategory] = useState(""),
    [cityLabel, setCityLabel] = useState(""),
    [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState(""),
    [confirm, setConfirm] = useState<"accept" | "reject" | null>(null);
  const person = state.users.find((item) => item.id === request.userId) || {
    id: "",
    name: "Equipe Kampive",
    email: "Cadastro administrativo",
  };
  const camp = state.camps.find((item) => item.id === request.campId);
  const pending = request.status === "pending_review";
  const execute = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      if (
        confirm === "accept" &&
        request.kind === "suggestion" &&
        mode === "existing" &&
        !existing
      )
        throw new Error("Selecione um camping existente.");
      await api.decide(request.kind, request.uuid!, {
        revision: request.revision,
        accept: confirm === "accept",
        notes,
        response,
        categoryUuid: category || null,
        cityUuid: city || null,
        existingUuid: mode === "existing" ? existing || null : null,
      });
      setConfirm(null);
      await update();
      notify("Decisão registrada.");
    } catch (cause) {
      setError((cause as Error).message);
      setConfirm(null);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <>
      <PageHead
        back="/solicitacoes"
        eyebrow={`${kinds[request.kind].toUpperCase()} · ${request.id}`}
        title={request.name}
        description={`Recebida em ${dateLabel(request.date)} · ${request.location}`}
        action={<Badge status={request.status} />}
      />
      <div className="detail-grid">
        <div className="stack">
          <section className="panel">
            <h2>Dados enviados</h2>
            <dl className="facts">
              <div>
                <dt>Solicitante</dt>
                <dd>
                  <a className="person-link" href={`#/usuarios/${person.id}`}>
                    <Avatar name={person.name} />
                    <span>
                      {person.name}
                      <small>{person.email}</small>
                    </span>
                  </a>
                </dd>
              </div>
              {request.instagram && (
                <div>
                  <dt>Perfil no Instagram</dt>
                  <dd>
                    <a
                      href={
                        request.instagram?.startsWith("https://")
                          ? request.instagram
                          : undefined
                      }
                      target="_blank"
                      rel="noreferrer"
                    >
                      Abrir Instagram ↗
                    </a>
                  </dd>
                </div>
              )}
              {request.maps && (
                <div>
                  <dt>Localização</dt>
                  <dd>
                    <a
                      href={
                        request.maps?.startsWith("https://")
                          ? request.maps
                          : undefined
                      }
                      target="_blank"
                      rel="noreferrer"
                    >
                      Abrir Google Maps ↗
                    </a>
                  </dd>
                </div>
              )}
              {request.contact && (
                <div>
                  <dt>Contato para verificação</dt>
                  <dd>{request.contact}</dd>
                </div>
              )}
              {request.evidence && (
                <div>
                  <dt>Informações para comprovar o vínculo</dt>
                  <dd>{request.evidence}</dd>
                </div>
              )}
            </dl>
            {camp && (
              <>
                <a className="related" href={`#/campings/${camp.id}`}>
                  <Icon name="tent" />
                  <span>
                    {camp.name}
                    <small>Conferir cadastro do camping</small>
                  </span>
                  <Icon name="arrow" />
                </a>
                {request.kind === "registration" && (
                  <div className="callout">
                    Revise o endereço, a cidade oficial, os contatos e as
                    coordenadas no cadastro antes de publicar.
                  </div>
                )}
              </>
            )}
            {request.kind === "claim" && (
              <div className="callout">
                A aprovação libera a gestão do camping e encerra outros pedidos
                de vínculo pendentes para o mesmo local.
              </div>
            )}
          </section>
          <section className="panel">
            <h2>Histórico da solicitação</h2>
            <RequestHistory id={request.id} />
          </section>
        </div>
        <section className="panel decision">
          <h2>{pending ? "Análise da equipe" : "Decisão registrada"}</h2>
          <p className="muted small">
            {pending
              ? "Confira as informações antes de concluir."
              : "Esta solicitação já foi concluída."}
          </p>
          {pending && request.kind === "suggestion" && (
            <>
              <label>
                Destino da indicação
                <select
                  value={mode}
                  onChange={(event) => setMode(event.target.value)}
                >
                  <option value="new">Criar um rascunho</option>
                  <option value="existing">Vincular a camping existente</option>
                </select>
              </label>
              {mode === "new" ? (
                <>
                  <CityPicker
                    value={city || null}
                    label={cityLabel}
                    onChange={(item) => {
                      setCity(item.uuid);
                      setCityLabel(`${item.name} · ${item.divisionName}`);
                    }}
                  />
                  <label>
                    Categoria
                    <select
                      value={category}
                      onChange={(event) => setCategory(event.target.value)}
                    >
                      <option value="">Selecione</option>
                      {catalog.categories.map((item) => (
                        <option key={item.uuid} value={item.uuid}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : (
                <CampingPicker value={existing} onChange={setExisting} />
              )}
              <p className="small muted">
                Aceitar a indicação não publica o camping nem concede
                propriedade.
              </p>
            </>
          )}
          <label>
            Notas internas <small>Somente para a equipe</small>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              disabled={!pending || busy}
              rows={3}
              maxLength={4000}
              placeholder="Registre o que foi conferido..."
            />
          </label>
          <label>
            Resposta ao solicitante <small>Mensagem destinada ao usuário</small>
            <textarea
              value={response}
              onChange={(event) => setResponse(event.target.value)}
              disabled={!pending || busy}
              rows={4}
              maxLength={4000}
              placeholder="Explique a decisão de forma clara..."
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {pending && (
            <>
              <button
                className="button full"
                disabled={busy}
                onClick={() => setConfirm("accept")}
              >
                <Icon name="check" size={17} />
                {request.kind === "suggestion"
                  ? "Aceitar indicação"
                  : request.kind === "claim"
                    ? "Aprovar vínculo"
                    : "Aprovar e publicar"}
              </button>
              <button
                className="button danger-outline full"
                disabled={busy}
                onClick={() => setConfirm("reject")}
              >
                Não aprovar
              </button>
              <p className="small muted">
                Indicações e vínculos geram uma notificação de resultado no
                aplicativo.
              </p>
            </>
          )}
        </section>
      </div>
      {confirm && (
        <Modal
          title={
            confirm === "reject"
              ? "Não aprovar solicitação?"
              : "Confirmar decisão?"
          }
          onClose={() => {
            if (!busy) setConfirm(null);
          }}
        >
          <p>
            {confirm === "reject"
              ? "A solicitação será encerrada com a resposta informada."
              : request.kind === "claim"
                ? "O vínculo será aprovado. Outros pedidos pendentes para este camping serão encerrados."
                : request.kind === "registration"
                  ? "O cadastro será publicado no aplicativo."
                  : "A indicação será aceita. A publicação do camping é uma etapa separada."}
          </p>
          <div className="actions">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setConfirm(null)}
            >
              Voltar à análise
            </button>
            <button
              className="button"
              disabled={busy}
              onClick={() => void execute()}
            >
              Confirmar decisão
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
function Camps() {
  const list = usePage<State["camps"][number]>("campings");
  const {query="", status="all"} = list.filters;
  const setQuery = (query: string) => list.change({query});
  const setStatus = (status: string) => list.change({status});
  const rows = list.loading || list.error ? [] : list.items;
  return (
    <>
      <PageHead
        eyebrow="CATÁLOGO KAMPIVE"
        title="Campings"
        description="Prepare novos destinos e cuide dos lugares que já fazem parte da comunidade."
        action={
          <a className="button" href="#/campings/novo">
            <Icon name="plus" size={18} />
            Novo camping
          </a>
        }
      />
      <section className="panel list-panel">
        <div className="filters">
          <Search
            value={query}
            onChange={setQuery}
            placeholder="Buscar nome ou cidade"
          />
          <select
            aria-label="Status do camping"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="all">Todos os status</option>
            {[
              "draft",
              "pending_review",
              "published",
              "rejected",
              "archived",
            ].map((item) => (
              <option key={item} value={item}>
                {statuses[item]}
              </option>
            ))}
          </select>
        </div>
        {rows.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Camping</th>
                  <th>Categoria</th>
                  <th>Status</th>
                  <th>Propriedade</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <a className="cell-title" href={`#/campings/${item.id}`}>
                        {item.name}
                      </a>
                      <span className="cell-sub">
                        {item.city || "Cidade a definir"}
                      </span>
                    </td>
                    <td>{item.category}</td>
                    <td>
                      <Badge status={item.status} />
                    </td>
                    <td>
                      {item.ownerName || "Sem vínculo"}
                    </td>
                    <td>
                      <a
                        className="row-action"
                        href={`#/campings/${item.id}`}
                        aria-label={`Editar ${item.name}`}
                      >
                        <Icon name="arrow" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title={list.loading ? "Carregando…" : list.error ? "Não foi possível carregar a lista" : "Nenhum resultado"} />
        )}
        <Pagination list={list} />
      </section>
    </>
  );
}
function Reviews({
  update,
  notify,
}: {
  update: () => Promise<void>;
  notify: (text: string) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false);
  const moderate = async (id: string, revision: number, status: string) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await api.reviewStatus(id, revision, status);
      await update();
      notify("Moderação registrada.");
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const list = usePage<State["reviews"][number]>("reviews", {status: "pending"});
  const {status="pending", query=""} = list.filters;
  const setQuery = (query: string) => list.change({query});
  const setStatus = (status: string) => list.change({status});
  const rows = list.loading || list.error ? [] : list.items;
  return (
    <>
      <PageHead
        eyebrow="VOZES DA COMUNIDADE"
        title="Avaliações"
        description="Ajude outras pessoas a encontrar relatos úteis, respeitosos e confiáveis."
      />
      <div className="panel filters">
        <Search
          value={query}
          onChange={setQuery}
          placeholder="Buscar camping, pessoa ou relato"
        />
        <select
          aria-label="Status da avaliação"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="all">Todas as avaliações</option>
          <option value="pending">Pendentes</option>
          <option value="published">Publicadas</option>
          <option value="hidden">Ocultas</option>
        </select>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="review-list">
        {rows.map((item) => {
          const user = {id:item.userId,name:item.userName || "Usuário"};
          return (
            <article className="panel review" key={item.id}>
              <div className="section-heading">
                <a className="person-link" href={`#/usuarios/${user.id}`}>
                  <Avatar name={user.name} />
                  <span>
                    {user.name}
                    <small>{dateLabel(item.date)}</small>
                  </span>
                </a>
                <Badge status={item.status} />
              </div>
              <a className="text-link" href={`#/campings/${item.campId}`}>
                <Icon name="tent" size={17} />
                {item.campName}
              </a>
              <div
                className="stars"
                aria-label={`${item.rating} de 5 estrelas`}
              >
                {"★".repeat(item.rating)}
                <span>{"★".repeat(5 - item.rating)}</span>
              </div>
              <p>{item.text}</p>
              <div className="photo-grid">
                {item.photos?.map((url) => (
                  <img
                    key={url}
                    src={url}
                    alt="Foto da avaliação"
                    referrerPolicy="no-referrer"
                  />
                ))}
              </div>
              <div className="review-actions">
                <small className="muted">
                  {item.photos?.length
                    ? `${item.photos.length} fotos anexadas`
                    : "Sem fotos anexadas."}
                </small>
                {(["published", "hidden"] as const)
                  .filter((value) => value !== item.status)
                  .map((value) => (
                    <button
                      className={`button ${value === "hidden" ? "secondary" : ""}`}
                      key={value}
                      disabled={busy}
                      onClick={() =>
                        void moderate(item.id, item.revision || 0, value)
                      }
                    >
                      {value === "published" ? "Publicar" : "Ocultar"}
                    </button>
                  ))}
              </div>
            </article>
          );
        })}
        {!rows.length && (
          <section className="panel">
            <Empty title={list.loading ? "Carregando…" : list.error ? "Não foi possível carregar a lista" : "Nenhuma avaliação nesta seleção"} />
          </section>
        )}
      </div>
      <Pagination list={list} />
    </>
  );
}
function Users() {
  const list = usePage<State["users"][number]>("users");
  const query = list.filters.query || "";
  const setQuery = (query: string) => list.change({query});
  const rows = list.loading || list.error ? [] : list.items;
  return (
    <>
      <PageHead
        eyebrow="NOSSA COMUNIDADE"
        title="Usuários"
        description="Consulte contribuições e vínculos para apoiar cada atendimento."
      />
      <section className="panel list-panel">
        <div className="filters">
          <Search
            value={query}
            onChange={setQuery}
            placeholder="Buscar nome, e-mail ou cidade"
          />
        </div>
        {rows.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Pessoa</th>
                  <th>Cidade</th>
                  <th>Solicitações</th>
                  <th>Vínculos</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <a className="person-link" href={`#/usuarios/${item.id}`}>
                        <Avatar name={item.name} />
                        <span>
                          {item.name}
                          <small>{item.email}</small>
                        </span>
                      </a>
                    </td>
                    <td>{item.city}</td>
                    <td>
                      {item.requestCount || 0}
                    </td>
                    <td>
                      {item.campCount || 0}
                    </td>
                    <td>
                      <a
                        className="row-action"
                        aria-label={`Ver ${item.name}`}
                        href={`#/usuarios/${item.id}`}
                      >
                        <Icon name="arrow" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title={list.loading ? "Carregando…" : list.error ? "Não foi possível carregar a lista" : "Nenhum resultado"} />
        )}
        <Pagination list={list} />
      </section>
    </>
  );
}
function RequestHistory({id}: {id:string}) {
  const list = usePage<{entryId:number;date:string;text:string}>("history", {id,size:10});
  return <><ol className="timeline">{!list.loading && !list.error && list.items.map(item => <li key={item.entryId}><span>{item.text}</span><small>{dateLabel(item.date)}</small></li>)}</ol><Pagination list={list} /></>;
}
function UserRequests({userId}: {userId:string}) {
  const list = usePage<Request>("requests", {userId, size:10});
  return <><RequestTable rows={list.loading || list.error ? [] : list.items} /><Pagination list={list} /></>;
}
function UserCamps({userId}: {userId:string}) {
  const list = usePage<State["camps"][number]>("campings", {ownerId:userId, size:10});
  return <>{!list.loading && !list.error && list.items.map(item => <a className="related" href={`#/campings/${item.id}`} key={item.id}><Icon name="tent" />{item.name}<Icon name="arrow" /></a>)}<Pagination list={list} /></>;
}
function CampingPicker({value,onChange}: {value:string;onChange:(id:string)=>void}) {
  const list = usePage<State["camps"][number]>("campings", {status:"available",size:10});
  const [selected,setSelected] = useState("");
  return <div className="camping-picker"><Search value={list.filters.query || ""} onChange={query => list.change({query})} placeholder="Buscar camping existente" />
    {selected && <p role="status">Selecionado: {selected}</p>}
    {!list.loading && !list.error && list.items.map(item => <label className="picker-option" key={item.id}><input type="radio" name="existing-camping" checked={value===item.id} onChange={() => {onChange(item.id);setSelected(item.name);}} />{item.name} · {item.city}</label>)}
    <Pagination list={list} />
  </div>;
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
