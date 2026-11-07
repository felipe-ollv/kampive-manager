import { createContext, useContext, useEffect, useState } from "react";
import { api, type Collection, type Filters, type Page } from "./api";
export const RefreshContext = createContext(0);
export function usePage<T>(collection: Collection, initial: Filters = {}) {
  const revision = useContext(RefreshContext);
  const [filters, setFilters] = useState<Filters>({page: 0, size: 25, ...initial});
  const [result, setResult] = useState<Page<T>>({items: [], page: 0, totalElements: 0, totalPages: 0});
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const key = JSON.stringify(filters);
  const identity = `${key}:${revision}:${retry}`;
  const [settled, setSettled] = useState("");
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      api.page<T>(collection, JSON.parse(key)).then(data => {
        if (active) { setResult(data); setError(""); }
      }).catch(cause => { if(active) setError((cause as Error).message); })
        .finally(() => {if(active) {setLoading(false); setSettled(identity);}});
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [collection, key, revision, retry, identity]);
  const change = (next: Filters) => {
    const updated = {...filters, page: 0, ...next};
    if (JSON.stringify(updated) === key) return;
    setLoading(true); setError("");
    setFilters(updated);
  };
  return { ...result, filters, loading: loading || settled !== identity, error, change, retry: () => {setLoading(true); setRetry(n => n+1);} };
}
export function Pagination({list}: {list: ReturnType<typeof usePage>}) {
  const {page,totalElements,totalPages,loading,filters,change,error} = list;
  const size = filters.size || 25;
  return <div className="pagination">
    {error ? <p className="error" role="alert">{error} <button className="text-button" onClick={list.retry}>Tentar novamente</button></p> :
      <span role="status">{loading ? "Carregando…" : totalElements ? `${page*size+1}–${Math.min((page+1)*size,totalElements)} de ${totalElements}` : "Nenhum resultado"}</span>}
    <label>Por página <select aria-label="Itens por página" value={size} disabled={loading} onChange={e => change({size: Number(e.target.value)})}>
      {[10,25,50].map(n => <option key={n} value={n}>{n}</option>)}
    </select></label>
    <nav aria-label="Paginação">
      <button className="button secondary" disabled={loading || page===0} onClick={() => change({page: page-1})}>Anterior</button>
      <span>Página {page+1} de {Math.max(1,totalPages)}</span>
      <button className="button secondary" disabled={loading || page+1>=totalPages} onClick={() => change({page: page+1})}>Próxima</button>
    </nav>
  </div>;
}
