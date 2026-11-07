import assert from "node:assert/strict";
import {test} from "node:test";
import {api} from "../src/api";
test("listas consultam apenas a página solicitada, com filtros no servidor", async () => {
  const calls: string[]=[];
  const original=globalThis.fetch;
  globalThis.fetch=async input => {calls.push(String(input));return new Response(JSON.stringify({items:[],page:3,totalElements:100,totalPages:10}));};
  try {
    const result=await api.page("campings",{page:3,size:10,query:"São Paulo",status:"published"});
    assert.equal(calls.length,1);
    const url=new URL(calls[0],"http://localhost");
    assert.equal(url.searchParams.get("page"),"3");
    assert.equal(url.searchParams.get("query"),"São Paulo");
    assert.equal(result.totalElements,100);
    calls.length=0;
    await api.load("/campings");
    assert.equal(calls.length,0,"abrir lista não pré-carrega coleções inteiras");
    await api.load("/campings/camping-id");
    assert.equal(calls.length,1);
    assert.ok(calls[0].includes("id=camping-id"));
  } finally {globalThis.fetch=original;}
});
