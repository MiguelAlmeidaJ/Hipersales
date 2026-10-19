import {CatalogEditor} from "@/components/catalog/catalog-editor";
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <CatalogEditor kind="products" standalone recordId={Number(id)}/>;}
