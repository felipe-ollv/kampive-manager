import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  api,
  emptyContent,
  type Catalog,
  type City,
  type Content,
  type Profile,
} from "./api";
import type { Camp } from "./domain";
import { Badge, Icon, Modal } from "./ui";
export function CityPicker({
  value,
  label,
  onChange,
}: {
  value: string | null;
  label: string;
  onChange: (city: City) => void;
}) {
  const [query, setQuery] = useState(label),
    [items, setItems] = useState<City[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    if (query.trim().length < 2) {
      setItems([]);
      return;
    }
    const timer = setTimeout(() => {
      api
        .cities(query)
        .then((rows) => {
          if (active) {
            setItems(rows);
            setError("");
          }
        })
        .catch(() => {
          if (active) setError("Não foi possível buscar cidades.");
        });
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);
  return (
    <div className="city-picker">
      <label>
        Buscar cidade oficial
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Digite pelo menos 2 letras"
        />
      </label>
      {value && <p className="small">Selecionada: {label}</p>}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {items.length > 0 && (
        <label>
          Resultados
          <select
            value=""
            onChange={(e) => {
              const city = items.find((item) => item.uuid === e.target.value);
              if (city) {
                onChange(city);
                setItems([]);
              }
            }}
          >
            <option value="">Selecione uma cidade da lista</option>
            {items.map((item) => (
              <option key={item.uuid} value={item.uuid}>
                {item.name} · {item.divisionName} · {item.countryName}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
export function Access({
  recovery,
  onLogin,
  message = "",
}: {
  recovery: boolean;
  onLogin: (profile: Profile) => Promise<void>;
  message?: string;
}) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(message),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const lock = useRef(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (recovery) {
        await api.recover(email);
        setNotice(
          "Se o endereço estiver cadastrado, você receberá as instruções por e-mail.",
        );
      } else {
        const profile = await api.login(email, password);
        setPassword("");
        await onLogin(profile);
      }
    } catch (cause) {
      setError((cause as Error).message);
      setPassword("");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="access">
      <section className="access-story">
        <a className="brand" href="#/login">
          <img src={`${import.meta.env.BASE_URL}brand.webp`} alt="" />
          <span>
            kampive<small>GESTÃO</small>
          </span>
        </a>
        <div>
          <Icon name="tent" size={64} />
          <h1>
            Boas aventuras
            <br />
            começam com
            <br />
            bons cuidados.
          </h1>
          <p>
            Um espaço para conectar pessoas, conferir histórias e preparar novos
            destinos.
          </p>
        </div>
        <small>O cuidado com a comunidade começa aqui.</small>
      </section>
      <section className="access-form">
        <span className="eyebrow">ESPAÇO DA EQUIPE</span>
        <h1>{recovery ? "Recuperar acesso" : "Bem-vindo de volta."}</h1>
        <p className="muted">
          {recovery
            ? "Informe seu e-mail para receber as instruções."
            : "Entre com sua conta administrativa do Kampive."}
        </p>
        <form onSubmit={submit}>
          <label>
            E-mail
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              maxLength={254}
              disabled={busy}
            />
          </label>
          {!recovery && (
            <label>
              Senha
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                maxLength={128}
                disabled={busy}
              />
            </label>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="callout" role="status">
              {notice}
            </p>
          )}
          <button className="button full" disabled={busy}>
            {busy
              ? "Aguarde…"
              : recovery
                ? "Enviar instruções"
                : "Entrar no portal"}
            <Icon name="arrow" size={18} />
          </button>
        </form>
        <a
          className="text-link"
          href={recovery ? "#/login" : "#/recuperar-acesso"}
        >
          {recovery ? "Voltar para acesso" : "Esqueci minha senha"}
        </a>
      </section>
    </div>
  );
}
export function CampEditor({
  camp,
  catalog,
  reload,
  notify,
}: {
  camp?: Camp;
  catalog: Catalog;
  reload: () => Promise<void>;
  notify: (text: string) => void;
}) {
  const [form, setForm] = useState<Content>(camp?.content || emptyContent()),
    [cityLabel, setCityLabel] = useState(camp?.city || ""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [action, setAction] = useState<string | null>(null);
  const lock = useRef(false);
  const field = <K extends keyof Content>(key: K, value: Content[K]) =>
    setForm((old) => ({ ...old, [key]: value }));
  async function save(event: FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await api.save(camp?.id, camp?.revision || 0, form);
      await reload();
      notify("Cadastro salvo.");
      window.location.hash = `/campings/${result.id}`;
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function changeStatus() {
    if (!camp || !action || lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      await api.campStatus(camp.id, camp.revision || 0, action);
      setAction(null);
      await reload();
      notify("Status atualizado.");
    } catch (cause) {
      setError((cause as Error).message);
      setAction(null);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function upload(files: FileList | null) {
    if (!files?.length || lock.current) return;
    if (files.length + form.photos.length > 9) {
      setError("São permitidas até 9 fotos.");
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      for (const file of Array.from(files)) {
        if (file.size > 10 * 1024 * 1024)
          throw new Error("Cada foto pode ter até 10 MB.");
        const photo = await api.upload(file);
        setForm((old) => ({ ...old, photos: [...old.photos, photo] }));
      }
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const changed =
    JSON.stringify(form) !== JSON.stringify(camp?.content || emptyContent());
  useEffect(() => {
    if (!changed) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [changed]);
  return (
    <>
      <a className="back" href="#/campings">
        ← Voltar
      </a>
      <div className="page-head">
        <div>
          <div className="eyebrow">CADASTRO OFICIAL</div>
          <h1>{camp?.name || "Um novo lugar para explorar."}</h1>
          <p>Confira os dados antes da publicação.</p>
        </div>
        <Badge status={camp?.status || "draft"} />
      </div>
      <form onSubmit={save}>
        <fieldset disabled={busy} className="unframed">
          <div className="detail-grid">
            <div className="stack">
              <section className="panel form-panel">
                <h2>Informações do camping</h2>
                <label>
                  Nome
                  <input
                    required
                    minLength={3}
                    maxLength={180}
                    value={form.name}
                    onChange={(e) => field("name", e.target.value)}
                  />
                </label>
                <label>
                  Categoria
                  <select
                    required
                    value={form.categoryUuid}
                    onChange={(e) => field("categoryUuid", e.target.value)}
                  >
                    <option value="">Selecione</option>
                    {catalog.categories.map((item) => (
                      <option key={item.uuid} value={item.uuid}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <CityPicker
                  value={form.cityUuid}
                  label={cityLabel}
                  onChange={(city) => {
                    field("cityUuid", city.uuid);
                    field("cityName", "");
                    setCityLabel(`${city.name} · ${city.divisionName}`);
                  }}
                />
                {!form.cityUuid && form.cityName && (
                  <p className="callout">
                    Cidade informada pelo usuário: {form.cityName}. Selecione a
                    cidade oficial para publicar.
                  </p>
                )}
                <label>
                  Descrição
                  <textarea
                    rows={5}
                    maxLength={10000}
                    value={form.description}
                    onChange={(e) => field("description", e.target.value)}
                  />
                </label>
                <label>
                  Endereço
                  <input
                    maxLength={200}
                    value={form.streetAddress}
                    onChange={(e) => field("streetAddress", e.target.value)}
                  />
                </label>
                <div className="form-row">
                  <label>
                    Número
                    <input
                      value={form.addressNumber}
                      onChange={(e) => field("addressNumber", e.target.value)}
                    />
                  </label>
                  <label>
                    Complemento
                    <input
                      value={form.addressComplement}
                      onChange={(e) =>
                        field("addressComplement", e.target.value)
                      }
                    />
                  </label>
                </div>
                <div className="form-row">
                  <label>
                    Bairro
                    <input
                      value={form.neighborhood}
                      onChange={(e) => field("neighborhood", e.target.value)}
                    />
                  </label>
                  <label>
                    CEP
                    <input
                      value={form.postalCode}
                      onChange={(e) => field("postalCode", e.target.value)}
                    />
                  </label>
                </div>
                <div className="form-row">
                  {(["latitude", "longitude"] as const).map((key) => (
                    <label key={key}>
                      {key === "latitude" ? "Latitude" : "Longitude"}
                      <input
                        type="number"
                        step="0.000001"
                        min={key === "latitude" ? -90 : -180}
                        max={key === "latitude" ? 90 : 180}
                        value={form[key] ?? ""}
                        onChange={(e) =>
                          field(
                            key,
                            e.target.value === ""
                              ? null
                              : Number(e.target.value),
                          )
                        }
                      />
                    </label>
                  ))}
                </div>
                <label>
                  Como chegar
                  <textarea
                    value={form.locationNotes}
                    onChange={(e) => field("locationNotes", e.target.value)}
                  />
                </label>
                <div className="form-row">
                  <label>
                    Diária a partir de
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.startingPricePerNight ?? ""}
                      onChange={(e) =>
                        field(
                          "startingPricePerNight",
                          e.target.value === "" ? null : Number(e.target.value),
                        )
                      }
                    />
                  </label>
                  <label>
                    Moeda
                    <select
                      value={form.currencyUuid || ""}
                      onChange={(e) =>
                        field("currencyUuid", e.target.value || null)
                      }
                    >
                      <option value="">Sem preço informado</option>
                      {catalog.currencies.map((item) => (
                        <option key={item.uuid} value={item.uuid}>
                          {item.isoCode}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </section>
              <section className="panel form-panel">
                <h2>Contatos públicos</h2>
                {form.contacts.map((item, index) => (
                  <div className="contact-row" key={index}>
                    <label>
                      Tipo
                      <select
                        value={item.typeUuid}
                        onChange={(e) =>
                          field(
                            "contacts",
                            form.contacts.map((x, i) =>
                              i === index
                                ? { ...x, typeUuid: e.target.value }
                                : x,
                            ),
                          )
                        }
                      >
                        <option value="">Selecione</option>
                        {catalog.contactTypes.map((type) => (
                          <option key={type.uuid} value={type.uuid}>
                            {type.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Contato
                      <input
                        value={item.value}
                        maxLength={500}
                        onChange={(e) =>
                          field(
                            "contacts",
                            form.contacts.map((x, i) =>
                              i === index ? { ...x, value: e.target.value } : x,
                            ),
                          )
                        }
                      />
                    </label>
                    <button
                      className="icon-button"
                      type="button"
                      aria-label="Remover contato"
                      onClick={() =>
                        field(
                          "contacts",
                          form.contacts.filter((_, i) => i !== index),
                        )
                      }
                    >
                      <Icon name="close" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="button secondary"
                  disabled={form.contacts.length >= 10}
                  onClick={() =>
                    field("contacts", [
                      ...form.contacts,
                      { typeUuid: "", value: "" },
                    ])
                  }
                >
                  Adicionar contato
                </button>
              </section>
              <section className="panel">
                <h2>Estrutura e comodidades</h2>
                <div className="amenities">
                  {catalog.amenities.map((item) => (
                    <label className="checkbox" key={item.uuid}>
                      <input
                        type="checkbox"
                        checked={form.amenityUuids.includes(item.uuid)}
                        onChange={(e) =>
                          field(
                            "amenityUuids",
                            e.target.checked
                              ? [...form.amenityUuids, item.uuid]
                              : form.amenityUuids.filter(
                                  (id) => id !== item.uuid,
                                ),
                          )
                        }
                      />
                      {item.name}
                    </label>
                  ))}
                </div>
                <h2 className="spaced">Ambiente natural</h2>
                <div className="amenities">
                  {catalog.settings.map((item) => (
                    <label className="checkbox" key={item.uuid}>
                      <input
                        type="checkbox"
                        checked={form.settingUuids.includes(item.uuid)}
                        onChange={(e) =>
                          field(
                            "settingUuids",
                            e.target.checked
                              ? [...form.settingUuids, item.uuid]
                              : form.settingUuids.filter(
                                  (id) => id !== item.uuid,
                                ),
                          )
                        }
                      />
                      {item.name}
                    </label>
                  ))}
                </div>
              </section>
              <section className="panel">
                <h2>Fotos · {form.photos.length}/9</h2>
                <p className="small muted">
                  A primeira imagem é a capa. Salve o cadastro após enviar ou
                  reorganizar as fotos.
                </p>
                <div className="photo-grid">
                  {form.photos.map((photo, index) => (
                    <div key={photo.url}>
                      <img
                        src={photo.url}
                        alt={photo.description || `Foto ${index + 1}`}
                        referrerPolicy="no-referrer"
                      />
                      <div className="actions">
                        {index > 0 && (
                          <button
                            type="button"
                            className="text-button"
                            onClick={() =>
                              field("photos", [
                                photo,
                                ...form.photos.filter((_, i) => i !== index),
                              ])
                            }
                          >
                            Usar como capa
                          </button>
                        )}
                        <button
                          type="button"
                          className="text-button"
                          onClick={() =>
                            field(
                              "photos",
                              form.photos.filter((_, i) => i !== index),
                            )
                          }
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <label>
                  Enviar fotos JPEG/PNG
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png"
                    onChange={(e) => {
                      void upload(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
              </section>
            </div>
            <aside className="panel decision">
              <h2>Publicação</h2>
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              <button type="submit" className="button full">
                {busy ? "Aguarde…" : "Salvar alterações"}
              </button>
              {changed && (
                <p className="small muted">Há alterações não salvas.</p>
              )}
              {camp?.status === "pending_review" ? (
                <a
                  className="button secondary full"
                  href={`#/solicitacoes/registration:${camp.id}`}
                >
                  Analisar solicitação
                </a>
              ) : (
                camp && (
                  <>
                    {camp.status !== "published" && (
                      <button
                        type="button"
                        className="button secondary full"
                        disabled={changed}
                        onClick={() => setAction("published")}
                      >
                        Publicar camping
                      </button>
                    )}
                    {camp.status !== "archived" && (
                      <button
                        type="button"
                        className="button danger-outline full"
                        disabled={changed}
                        onClick={() => setAction("archived")}
                      >
                        Arquivar camping
                      </button>
                    )}
                  </>
                )
              )}
              <p className="small muted">
                A publicação exige cidade oficial, endereço, coordenadas,
                descrição, contato e foto. O vínculo de propriedade é analisado
                separadamente.
              </p>
            </aside>
          </div>
        </fieldset>
      </form>
      {action && (
        <Modal
          title={
            action === "published" ? "Publicar camping?" : "Arquivar camping?"
          }
          onClose={() => {
            if (!busy) setAction(null);
          }}
        >
          <p>Esta alteração será aplicada ao catálogo real do aplicativo.</p>
          <div className="actions">
            <button
              disabled={busy}
              className="button secondary"
              onClick={() => setAction(null)}
            >
              Cancelar
            </button>
            <button
              disabled={busy}
              className="button"
              onClick={() => void changeStatus()}
            >
              {busy ? "Salvando…" : "Confirmar"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
