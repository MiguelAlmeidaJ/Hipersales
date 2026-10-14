import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { hasAdminAccess, type PublicUser } from "@hipersales/contracts";
import { DatabaseRepository } from "../database/database.repository.js";

type Row=Record<string,unknown>;
const str=(v:unknown)=>String(v??"");
const statusNames:Record<string,string>={aberta:"Aberta",em_analise:"Em analise",recusada:"Recusada",solucionada:"Solucionada"};
export function occurrenceStatus(value:unknown):string{
  const status=str(value).trim();
  const aliases:Record<string,string>={em_tratamento:"em_analise",tratada:"solucionada",encerrada:"solucionada",solucionado:"solucionada"};
  return aliases[status]||status;
}
@Injectable()
export class OccurrencesService {
  constructor(private readonly database:DatabaseRepository){}
  async list(user:PublicUser){
    await this.cleanupExpiredAttachments(user.tenant_id);
    const db=this.database.db;
    const rows=await db.prepare(`SELECT o.*,u.name AS seller_name,
      COALESCE(NULLIF(u.communication_email,''),u.email) AS seller_email,
      c.legal_name AS customer_name,c.trade_name AS customer_trade_name,
      c.cnpj AS customer_cnpj,c.state_registration AS customer_state_registration,
      c.address AS customer_address,c.phone AS customer_phone,c.email AS customer_email
      FROM occurrences o JOIN users u ON u.id=o.seller_id
      JOIN customers c ON c.id=o.customer_id
      WHERE o.tenant_id=? ${hasAdminAccess(user.role)?"":"AND o.seller_id=?"}
      ORDER BY o.created_at DESC,o.id DESC`).all(...(hasAdminAccess(user.role)?[user.tenant_id]:[user.tenant_id,user.id])) as Row[];
    const attachments=db.prepare(`SELECT id,filename,mimetype,created_at FROM occurrence_attachments
      WHERE occurrence_id=? AND tenant_id=? ORDER BY id`);
    const events=db.prepare(`SELECT oe.*,u.name AS created_by_name FROM occurrence_events oe
      LEFT JOIN users u ON u.id=oe.created_by
      WHERE oe.occurrence_id=? AND oe.tenant_id=? ORDER BY oe.created_at,oe.id`);
    return {occurrences:await Promise.all(rows.map(async row=>{
      let names:unknown=[];
      try{ names=JSON.parse(str(row.attachment_names||"[]")); }catch{names=[];}
      const attachmentNames=Array.isArray(names)?names:[];
      const attached=await attachments.all(Number(row.id),user.tenant_id);
      const timeline=await events.all(Number(row.id),user.tenant_id) as Row[];
      const current=occurrenceStatus(row.status);
      if(!timeline.length){
        timeline.push({id:0,occurrence_id:row.id,status:"aberta",title:"Ocorrencia aberta",
          notes:"Registro enviado e aguardando verificacao da retaguarda.",
          created_by_name:row.seller_name,created_at:row.created_at});
        if(current!=="aberta"||row.updated_at!==row.created_at) timeline.push({
          id:0,occurrence_id:row.id,status:current,title:statusNames[current]||current,
          notes:row.resolution||"Status atualizado pela retaguarda.",
          created_by_name:"Retaguarda",created_at:row.updated_at||row.created_at,
        });
      }
      return {...row,attachment_names:attachmentNames,attachments:attached,
        attachments_expired:Boolean(attachmentNames.length&&!attached.length&&current==="solucionada"),timeline};
    }))};
  }
  async cleanupExpiredAttachments(tenantId:number):Promise<number> {
    const cutoff=new Date(Date.now()-30*24*60*60*1000).toISOString();
    return (await this.database.db.prepare(`DELETE FROM occurrence_attachments
      WHERE tenant_id=? AND occurrence_id IN (
        SELECT id FROM occurrences WHERE tenant_id=?
          AND status IN ('solucionada','solucionado','tratada','encerrada')
          AND resolved_at IS NOT NULL AND resolved_at<=?
      )`).run(tenantId,tenantId,cutoff)).changes;
  }
  update(user:PublicUser,id:number,input:Row){
    if(!Number.isSafeInteger(id)||id<=0||!input||typeof input!=="object"||Array.isArray(input))
      throw new BadRequestException("Ocorrencia invalida.");
    return this.database.transaction(async ()=>{
      const db=this.database.db;
      const before=await db.prepare("SELECT status,resolution,resolved_at FROM occurrences WHERE id=? AND tenant_id=?")
        .get(id,user.tenant_id) as Row|undefined;
      if(!before) throw new NotFoundException("Ocorrencia nao encontrada.");
      const status=occurrenceStatus(input.status||before.status);
      if(!(status in statusNames)) throw new BadRequestException("Status de ocorrencia invalido.");
      const resolution=str(input.resolution||"").trim();
      const now=new Date().toISOString();
      const resolvedAt=status==="solucionada"?(str(input.resolved_at||before.resolved_at)||now):null;
      await db.prepare("UPDATE occurrences SET status=?,resolution=?,resolved_at=?,updated_at=? WHERE id=? AND tenant_id=?")
        .run(status,resolution,resolvedAt,now,id,user.tenant_id);
      if(occurrenceStatus(before.status)!==status||str(before.resolution).trim()!==resolution||str(before.resolved_at)!==str(resolvedAt))
        await db.prepare(`INSERT INTO occurrence_events
          (occurrence_id,tenant_id,status,title,notes,created_by,created_at) VALUES (?,?,?,?,?,?,?)`)
          .run(id,user.tenant_id,status,statusNames[status],resolution||"Ocorrencia atualizada pela retaguarda.",user.id,now);
      return {message:"Ocorrencia atualizada."};
    });
  }
  async attachment(user:PublicUser,occurrenceId:number,attachmentId:number){
    if(!Number.isSafeInteger(occurrenceId)||occurrenceId<1||!Number.isSafeInteger(attachmentId)||attachmentId<1)
      throw new BadRequestException("Anexo invalido.");
    const record=await this.database.db.prepare(`SELECT oa.filename,oa.mimetype,oa.content,o.seller_id
      FROM occurrence_attachments oa JOIN occurrences o ON o.id=oa.occurrence_id
      WHERE oa.id=? AND oa.occurrence_id=? AND oa.tenant_id=? AND o.tenant_id=?`)
      .get(attachmentId,occurrenceId,user.tenant_id,user.tenant_id) as
      {filename:string;mimetype:string;content:Uint8Array;seller_id:number}|undefined;
    if(!record) throw new NotFoundException("Anexo nao encontrado.");
    if(!hasAdminAccess(user.role)&&Number(record.seller_id)!==user.id)
      throw new ForbiddenException("Voce nao tem acesso a este anexo.");
    return {filename:record.filename,mimetype:record.mimetype,content:Buffer.from(record.content)};
  }
  delete(user:PublicUser,id:number){
    if(!Number.isSafeInteger(id)||id<=0) throw new BadRequestException("Ocorrencia invalida.");
    return this.database.transaction(async ()=>{
      const db=this.database.db;
      const found=await db.prepare("SELECT 1 FROM occurrences WHERE id=? AND tenant_id=?").get(id,user.tenant_id);
      if(!found) throw new NotFoundException("Ocorrencia nao encontrada.");
      await db.prepare("DELETE FROM occurrence_attachments WHERE occurrence_id=? AND tenant_id=?").run(id,user.tenant_id);
      await db.prepare("DELETE FROM occurrence_events WHERE occurrence_id=? AND tenant_id=?").run(id,user.tenant_id);
      const result=await db.prepare("DELETE FROM occurrences WHERE id=? AND tenant_id=?").run(id,user.tenant_id);
      if(!result.changes) throw new NotFoundException("Ocorrencia nao encontrada.");
      return {message:"Ocorrencia excluida definitivamente."};
    });
  }
}
