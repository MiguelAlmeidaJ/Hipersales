import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import type { PublicUser } from "@hipersales/contracts";
import { DatabaseService } from "../database/database.service.js";

type Data = Record<string,unknown>;
export function decodeOccurrenceAttachments(value:unknown) {
  if(value==null) return [] as {filename:string;mimetype:string;content:Buffer}[];
  if(!Array.isArray(value)) throw new BadRequestException("Anexos invalidos.");
  let total=0;
  return value.map((entry:unknown)=>{
    if(!entry||typeof entry!=="object"||Array.isArray(entry)) throw new BadRequestException("Anexo invalido.");
    const row=entry as Data;
    const filename=String(row.filename||"anexo").trim().slice(0,140)||"anexo";
    const mimetype=String(row.mimetype||"application/octet-stream");
    const source=String(row.content||"");
    const encoded=source.startsWith("data:")?source.slice(source.indexOf(",")+1):source;
    if(!encoded||encoded.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded))
      throw new BadRequestException("Anexo invalido.");
    const content=Buffer.from(encoded,"base64");
    total+=content.length;
    if(total>25*1024*1024) throw new BadRequestException("Anexos excedem 25 MB.");
    return {filename,mimetype,content};
  });
}
@Injectable()
export class OccurrenceCreationService {
  constructor(private readonly database:DatabaseService){}
  create(user:PublicUser,input:Data) {
    if(!["seller","admin"].includes(user.role)) throw new ForbiddenException("Permissao negada.");
    const customerId=Number(input.customer_id),sellerId=Number(input.seller_id||user.id);
    const reason=String(input.reason||"").trim(),description=String(input.description||"").trim();
    if(!Number.isSafeInteger(customerId)||!Number.isSafeInteger(sellerId)||!reason||!description)
      throw new BadRequestException("Informe cliente, motivo e relato.");
    const attachments=decodeOccurrenceAttachments(input.attachments);
    return this.database.transaction(()=>{
      const db=this.database.db,tenant=user.tenant_id;
      if(user.role==="admin"&&!db.prepare("SELECT 1 FROM users WHERE id=? AND tenant_id=? AND role='seller' AND active=1").get(sellerId,tenant))
        throw new BadRequestException("Representante invalido.");
      if(user.role!=="admin"&&sellerId!==user.id) throw new ForbiddenException("Representante invalido.");
      const customer=db.prepare("SELECT * FROM customers WHERE id=? AND tenant_id=? AND active=1").get(customerId,tenant) as Data|undefined;
      if(!customer) throw new BadRequestException("Cliente invalido.");
      if(user.role!=="admin"&&!db.prepare("SELECT 1 FROM customer_sellers WHERE customer_id=? AND seller_id=?").get(customerId,sellerId))
        throw new ForbiddenException("Cliente nao associado ao representante.");
      const seller=db.prepare("SELECT name,email,communication_email FROM users WHERE id=? AND tenant_id=?").get(sellerId,tenant) as Data|undefined;
      const display=(v:unknown)=>String(v||"").trim()||"-";
      const now=new Date().toISOString();
      const id=Number(db.prepare("INSERT INTO occurrences (tenant_id,seller_id,customer_id,reason,description,attachment_names,status,resolution,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
        .run(tenant,sellerId,customerId,reason,description,JSON.stringify(attachments.map(a=>a.filename)),"aberta","",now,now).lastInsertRowid);
      db.prepare("INSERT INTO occurrence_events (occurrence_id,tenant_id,status,title,notes,created_by,created_at) VALUES (?,?,?,?,?,?,?)")
        .run(id,tenant,"aberta","Ocorrencia aberta","Registro enviado e aguardando verificacao da retaguarda.",sellerId,now);
      const insert=db.prepare("INSERT INTO occurrence_attachments (occurrence_id,tenant_id,filename,mimetype,content,created_at) VALUES (?,?,?,?,?,?)");
      for(const a of attachments) insert.run(id,tenant,a.filename,a.mimetype,a.content,now);
      db.prepare("INSERT INTO email_outbox (tenant_id,kind,recipients,subject,body,created_at) VALUES (?,?,?,?,?,?)")
        .run(tenant,"occurrence_created","vendas@hipermixrepresentacoes.com.br,thallesmachadocomercial@gmail.com",
          "NOVA OCORRENCIA "+String(customer.legal_name||"")+" "+String(customer.cnpj||""),
          [
 "Nova ocorrencia registrada no HiperSales Web.","","Ocorrencia: #"+id,
 "Representante comercial: "+display(seller?.name||user.name),
 "E-mail do representante: "+display(seller?.communication_email||seller?.email),
 "Cliente: "+display(customer.legal_name),
 "Nome fantasia: "+display(customer.trade_name),
 "CNPJ: "+display(customer.cnpj),
 "Inscricao estadual: "+display(customer.state_registration),
 "Endereco: "+display(customer.address),
 "Telefone: "+display(customer.phone),
 "E-mail cliente: "+display(customer.email),"",
 "Motivo: "+reason,"","Relato:",description,"",
 "Anexos: "+(attachments.length?attachments.map(a=>a.filename).join(", "):"Sem anexos."),
 ].join("\\n"),now);
      return {id,message:"Ocorrencia registrada e enviada para analise."};
    });
  }
}
