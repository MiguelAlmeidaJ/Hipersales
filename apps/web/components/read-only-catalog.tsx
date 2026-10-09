"use client";
import {useEffect,useState} from "react";
import {api} from "../lib/api";
type Section="customers"|"companies"|"products";
type RecordData=Record<string,unknown>;
const endpoints:Record<Section,`/api/${string}`>={customers:"/api/customers",companies:"/api/companies",products:"/api/products"};
const labels:Record<Section,string>={customers:"Clientes",companies:"Empresas",products:"Produtos"};
export default function ReadOnlyCatalog({section}:{section:Section}){
 const [items,setItems]=useState<RecordData[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
 useEffect(()=>{let active=true;setLoading(true);setError("");
 api<RecordData>(endpoints[section]).then(data=>{if(active)setItems(Array.isArray(data[section])?data[section] as RecordData[]:[])}).catch(e=>{if(active)setError(e instanceof Error?e.message:"Erro ao consultar registros")}).finally(()=>{if(active)setLoading(false)});
 return()=>{active=false}},[section]);
 const fields=section==="customers"?["legal_name","trade_name","cnpj"]:section==="companies"?["name","legal_name"]:["code","name","price"];
 return <section className="tile"><h1 className="mb-2 text-2xl font-bold">{labels[section]}</h1><p className="mb-5 text-sm text-slate-500">Consulta dos registros disponíveis.</p>
 {loading?<p role="status">Carregando…</p>:error?<p role="alert" className="text-red-700">{error}</p>:<div className="table-wrap"><table><thead><tr>{fields.map(field=><th key={field}>{field.replaceAll("_"," ")}</th>)}</tr></thead><tbody>{items.map((item,index)=><tr key={String(item.id??index)}>{fields.map(field=><td key={field}>{item[field]==null?"—":String(item[field])}</td>)}</tr>)}</tbody></table>{!items.length&&<p className="p-5 text-slate-500">Nenhum registro disponível.</p>}</div>}
 </section>
}
