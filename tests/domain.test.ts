import assert from "node:assert/strict";
import { test } from "node:test";
import { initialState } from "../src/data";
import { decide, publicationError } from "../src/domain";
test("aceitar indicação cria rascunho sem propriedade e não altera os exemplos originais", () => {
  const draft = { ...initialState.camps[0], id: "new", ownerId: "u1" };
  const next = decide(
    initialState,
    "SOL-1048",
    "accept",
    "Conferido",
    "Recebemos sua indicação.",
    draft,
  );
  assert.equal(next.camps.at(-1)?.status, "draft");
  assert.equal(next.camps.at(-1)?.ownerId, undefined);
  assert.equal(next.requests[0].status, "accepted");
  assert.equal(initialState.requests[0].status, "pending_review");
});
test("vínculo aprovado encerra concorrentes e preserva publicação", () => {
  const next = decide(
    initialState,
    "SOL-1049",
    "accept",
    "",
    "Vínculo conferido.",
  );
  assert.equal(next.camps[0].ownerId, "u4");
  assert.equal(next.camps[0].status, "published");
  assert.equal(
    next.requests.find((item) => item.id === "SOL-1053")?.status,
    "rejected",
  );
  assert.throws(() => decide(next, "SOL-1049", "accept", "", "Repetir"));
});
test("recusa de cadastro e resposta pública separada das notas", () => {
  const next = decide(
    initialState,
    "SOL-1050",
    "reject",
    "Análise interna",
    "Revise os dados.",
  );
  assert.equal(next.camps[1].status, "rejected");
  assert.equal(next.requests[2].response, "Revise os dados.");
  assert.equal(next.requests[2].notes, "Análise interna");
});
test("publicação valida localização e bloqueia decisão sem resposta", () => {
  assert.ok(publicationError({ ...initialState.camps[0], latitude: "91" }));
  assert.ok(publicationError({ ...initialState.camps[0], city: "" }));
  assert.throws(() =>
    decide(initialState, "SOL-1049", "accept", "Nota interna", ""),
  );
});
test("indicação pode se vincular ao catálogo sem duplicar camping", () => {
  const next = decide(
    initialState,
    "SOL-1048",
    "accept",
    "",
    "Já está no catálogo.",
    undefined,
    "c1",
  );
  assert.equal(next.camps.length, initialState.camps.length);
  assert.equal(next.requests[0].campId, "c1");
  assert.equal(next.camps[0].ownerId, undefined);
});
