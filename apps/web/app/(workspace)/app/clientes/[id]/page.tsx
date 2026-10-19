import CustomerEditor from "@/components/customers/customer-editor";
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <CustomerEditor standalone customerId={Number(id)}/>;}
